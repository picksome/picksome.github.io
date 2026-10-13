/**
 * 순수 마진 계산 — Ops Tool `backend/app/services/calculation.py` 의 브라우저 이식본.
 *
 * 원본과의 약속
 * ------------
 *  1. 금액은 정수(원), 비율은 `rate4`(1/10000 단위 정수). **float 금지.**
 *  2. 반올림 지점과 방식(ROUND_HALF_UP)을 원본 `apply_rate`/`to_krw` 와 일치시킨다.
 *  3. **산식은 `MARGIN_FORMULA` 한 곳에만 있다.** 화면용으로 다시 쓰지 않는다.
 *  4. 정책이 없는 것(`UNKNOWN`)과 값이 0 인 것을 구분한다. 산술은 원본대로 0 을
 *     쓰지만, 0 으로 뭉갰다는 사실을 `confidence`/`warnings` 로 반드시 드러낸다.
 *
 * 원본이 DB 에서 읽던 정책 테이블은 여기서는 사용자가 화면에서 직접 넣는다.
 * 계산식 자체는 손대지 않았다.
 */

import { applyRate, halfUpDiv, quantizeRate4, RATE_SCALE } from './money.js';

/** 마진 산식 — 단일 정의. UI 는 이 문자열을 그대로 보여준다. */
export const MARGIN_FORMULA =
  '마진 = 판매가 − 원가 − 마켓수수료 − 결제수수료 − 광고비 − 반품위험비용 − 물류비 − 부가세';

/** 마진 유형 4종. 원본 `margin_type`. */
export const MARGIN_TYPES = {
  PURCHASE_AGENCY: '구매대행',
  ROCKET_GROWTH: '로켓그로스',
  OVERSEAS_DIRECT: '해외직구',
  GENERAL_RESELL: '일반 사입·리셀',
};

/** 값의 출처. 원본 `confidence: ACTUAL/ESTIMATED/UNKNOWN`. */
export const CONFIDENCE = {
  ACTUAL: 'ACTUAL',       // 사용자가 실제 값을 넣음
  ESTIMATED: 'ESTIMATED', // 기본값·평균치를 씀
  UNKNOWN: 'UNKNOWN',     // 모름 → 0 으로 계산됨. 결과는 실제보다 **낙관적**이다
};

const UNSET = Symbol('unset');

// ─── 수수료 계산 (원본 함수 1:1) ───────────────────────────────────

/**
 * 마켓 수수료. 원본 `calc_marketplace_fee`.
 * policy 없으면 0 — 단 호출자는 그것이 "수수료 없음"이 아니라 "모름"일 수 있음을 알아야 한다.
 * @param {{feeType:'RATE'|'FIXED'|'TIERED', rate4?:number, fixedAmount?:number, tiers?:Array}} policy
 */
export function calcMarketplaceFee(salePrice, policy) {
  if (!policy) return 0;
  if (policy.feeType === 'RATE') return applyRate(salePrice, policy.rate4 ?? 0);
  if (policy.feeType === 'FIXED') return policy.fixedAmount ?? 0;
  if (policy.feeType === 'TIERED') return applyTieredFee(salePrice, policy.tiers ?? []);
  throw new Error(`unknown feeType=${policy.feeType}`);
}

/**
 * 구간 수수료. 원본 `apply_tiered_fee`.
 * tiers = [{min, max?, rate4?, fixed?}] — 매칭되는 **첫** 구간을 적용한다.
 * 구간 판정은 `min <= price < max`. 역산(`solveTiered`)과 반드시 같아야 한다.
 */
export function applyTieredFee(salePrice, tiers) {
  for (const tier of tiers) {
    const lo = Number(tier.min ?? 0);
    const hi = tier.max === null || tier.max === undefined ? null : Number(tier.max);
    if (salePrice >= lo && (hi === null || salePrice < hi)) {
      if (tier.rate4 !== undefined && tier.rate4 !== null) return applyRate(salePrice, tier.rate4);
      if (tier.fixed !== undefined && tier.fixed !== null) return Number(tier.fixed);
    }
  }
  return 0;
}

/** 결제 PG 수수료. 원본 `calc_payment_fee`. policy 없으면 0 (예: 계좌이체). */
export function calcPaymentFee(salePrice, policy) {
  if (!policy) return 0;
  return applyRate(salePrice, policy.rate4);
}

/**
 * 광고비. 원본 `calc_ad_cost`.
 * 우선순위: extras.adCost(원 직접) > extras.adRatio4 > 정책 기본 비율
 */
export function calcAdCost(salePrice, extras, adDefaultRatio4) {
  if (extras.adCost !== undefined && extras.adCost !== null) return Number(extras.adCost);
  let ratio4 = extras.adRatio4;
  if (ratio4 === undefined || ratio4 === null) ratio4 = adDefaultRatio4;
  if (ratio4 === undefined || ratio4 === null) return 0;
  return applyRate(salePrice, ratio4);
}

/**
 * 물류비. 원본 `calc_fulfillment_fee`.
 * GENERAL_RESELL 은 0 (사입은 직접 보관·발송하므로 물류 대행비가 없다).
 */
export function calcFulfillmentFee(marginType, policies, extras) {
  if (marginType === 'GENERAL_RESELL') return 0;
  const pol = policies.fulfillment;
  if (!pol) return Number(extras.fulfillmentFee ?? 0);
  const inbound = pol.inboundFee ?? 0;
  const outbound = pol.outboundFee ?? 0;
  const storageDays = Number(extras.storageDays ?? 0);
  const storage = (pol.storageFeePerDay ?? 0) * storageDays;
  return inbound + outbound + storage;
}

/** 반품 위험 비용 = 판매가 × 반품률. 원본 `calc_return_risk_cost`. */
export function calcReturnRiskCost(salePrice, returnRate4) {
  if (returnRate4 === null || returnRate4 === undefined) return 0;
  return applyRate(salePrice, returnRate4);
}

/**
 * 부가세. 원본 `calc_vat`.
 * 과세표준은 호출자가 결정한다 — 마진 계산에서는 `(판매가 − 마켓수수료)` 로 단순화한다.
 */
export function calcVat(taxableAmount, vatRate4) {
  return applyRate(taxableAmount, vatRate4);
}

/**
 * 마진 유형별 원가 보정. 원본 `calc_total_cost_for_margin_type`.
 *  - PURCHASE_AGENCY: 공급가 + 구매대행 수수료 + 국제배송
 *  - OVERSEAS_DIRECT: 공급가 + 관세 + 환율조정
 *  - ROCKET_GROWTH / GENERAL_RESELL: 입력 원가 그대로
 */
export function calcTotalCostForMarginType(marginType, baseCost, extras) {
  let cost = baseCost;
  if (marginType === 'PURCHASE_AGENCY') {
    cost += Number(extras.agencyFee ?? 0);
    cost += Number(extras.intlShipping ?? 0);
  } else if (marginType === 'OVERSEAS_DIRECT') {
    cost += Number(extras.customs ?? 0);
    cost += Number(extras.fxAdjustment ?? 0);
  }
  return cost;
}

// ─── 정방향: 예상 마진 ─────────────────────────────────────────────

/**
 * 정책 중 비어 있는 항목을 모아 경고로 바꾼다.
 * 원본에는 없는 추가 안전장치다 — 정적 사이트에서는 DB 기본값이 없어서
 * 사용자가 빈칸으로 두면 전부 0 이 되고, 그러면 마진이 조용히 부푼다.
 */
function auditPolicies(policies, marginType, extras) {
  const missing = [];
  if (!policies.marketplaceFee) missing.push('마켓 수수료');
  if (!policies.paymentFee) missing.push('결제 수수료');
  const adGiven = policies.adCost
    || extras.adCost !== undefined && extras.adCost !== null
    || extras.adRatio4 !== undefined && extras.adRatio4 !== null;
  if (!adGiven) missing.push('광고비');
  if (!policies.returnRisk) missing.push('반품률');
  // 물류비는 정책으로 넣든 `extras.fulfillmentFee` 로 직접 넣든 들어왔으면 된 것이다.
  // GENERAL_RESELL 은 구조상 0 이므로 애초에 묻지 않는다.
  if (marginType !== 'GENERAL_RESELL' && !policies.fulfillment
      && extras.fulfillmentFee === undefined) missing.push('물류비');
  return missing;
}

/**
 * 예상 마진 — 순수 함수. 원본 `compute_expected_margin`.
 *
 * @param {{salePrice:number, costAmount:number, marginType:string,
 *          extras?:object, overrideFields?:object}} input
 * @param {object} policies  {marketplaceFee, paymentFee, adCost, fulfillment, returnRisk, tax}
 */
export function computeExpectedMargin(input, policies) {
  const sp = input.salePrice;
  if (!Number.isInteger(sp) || sp <= 0) throw new Error('판매가는 0보다 큰 정수여야 합니다');
  if (!policies.tax || policies.tax.vatRate4 === null || policies.tax.vatRate4 === undefined) {
    throw new Error('부가세율이 설정되지 않았습니다');
  }

  const extras = input.extras ?? {};
  const vatRate4 = policies.tax.vatRate4;

  let mfee = calcMarketplaceFee(sp, policies.marketplaceFee);
  let pfee = calcPaymentFee(sp, policies.paymentFee);
  let ad = calcAdCost(sp, extras, policies.adCost ? policies.adCost.defaultAdRatio4 : null);
  let fulfill = calcFulfillmentFee(input.marginType, policies, extras);
  let rrisk = calcReturnRiskCost(sp, policies.returnRisk ? policies.returnRisk.returnRate4 : null);
  let vat = calcVat(sp - mfee, vatRate4);

  const realCost = calcTotalCostForMarginType(input.marginType, input.costAmount, extras);

  const warnings = [];
  const missing = auditPolicies(policies, input.marginType, extras);
  if (missing.length) {
    warnings.push(
      `${missing.join(', ')}이(가) 비어 있어 0원으로 계산했습니다. ` +
      '실제 마진은 아래 결과보다 낮습니다.',
    );
  }
  if (policies.marketplaceFee?.reliabilityStatus === 'NEEDS_REVIEW') {
    warnings.push('마켓 수수료 정책이 검토 필요(NEEDS_REVIEW) 상태입니다');
  }

  // 원본의 override 분기. 사용자가 개별 항목을 직접 갈아끼운 경우.
  const ov = input.overrideFields;
  if (ov && Object.keys(ov).length) {
    if (ov.marketplaceFee !== undefined) mfee = Number(ov.marketplaceFee);
    if (ov.paymentFee !== undefined) pfee = Number(ov.paymentFee);
    if (ov.adCost !== undefined) ad = Number(ov.adCost);
    if (ov.fulfillmentFee !== undefined) fulfill = Number(ov.fulfillmentFee);
    if (ov.returnRiskCost !== undefined) rrisk = Number(ov.returnRiskCost);
    if (ov.vat !== undefined) vat = Number(ov.vat);
    if (ov.marketplaceFee !== undefined && ov.vat === undefined) {
      // 과세표준이 (판매가 − 마켓수수료) 라 수수료를 갈아끼우면 부가세도 따라 움직여야
      // 한다. 재계산하지 않으면 정책 요율로 계산된 부가세가 남아 앞뒤가 안 맞는다.
      vat = calcVat(sp - mfee, vatRate4);
    }
    warnings.push('수동 입력값이 적용되었습니다');
  }

  const grossIn = sp - mfee - pfee - ad - fulfill - rrisk;
  const marginAmount = grossIn - realCost - vat;
  const marginRate4 = quantizeRate4(BigInt(marginAmount), BigInt(sp));

  return {
    salePrice: sp,
    realCost,
    marketplaceFee: mfee,
    paymentFee: pfee,
    adCost: ad,
    fulfillmentFee: fulfill,
    returnRiskCost: rrisk,
    vat,
    marginAmount,
    marginRate4,
    confidence: missing.length ? CONFIDENCE.UNKNOWN : CONFIDENCE.ACTUAL,
    missingPolicies: missing,
    warnings,
  };
}

// ─── 역산: 목표 마진을 만드는 판매가 ───────────────────────────────

/**
 * `마진율 = 목표마진율` 이 되는 판매가 역산. 원본 `reverse_calc_price_for_target_margin`.
 *
 * 정방향 식을 그대로 뒤집는다
 * -----------------------
 *     마진 = sp − mfee − pfee − ad − fulfill − rrisk − cost − vat
 *     vat  = (sp − mfee) × vat_rate
 *
 * `mfee = sp × mfee_rate + mfee_fixed` 로 두고 정리하면
 *
 *     sp × (1 − mfee_rate − pay − ad − ret − vat_eff − target)
 *         = cost + fulfill + mfee_fixed × (1 − vat_rate)
 *     vat_eff = vat_rate × (1 − mfee_rate)
 *
 * `mfee_fixed` 에 `(1 − vat_rate)` 가 붙는 이유
 * ----------------------------------------
 * 정액 수수료는 **과세표준을 깎는다**(`vat = (sp − mfee) × vat_rate`).
 * 그래서 수수료 1,000원의 실질 부담은 1,000원이 아니라 `1,000 × (1 − 0.1) = 900원` 이다.
 * 원본에서 이 가중치가 빠졌을 때 분자가 과대해져 역산가가 높게 나왔고,
 * 실제 마진이 목표를 넘었다(정액 1,000원·부가세 10%에서 +0.64%p). 지우지 말 것.
 *
 * @returns {{price:number, tierIndex:number|null}}
 */
export function reverseCalcPriceForTargetMargin(targetRate4, costAmount, marginType, policies, extras = {}) {
  if (!policies.tax || policies.tax.vatRate4 === null || policies.tax.vatRate4 === undefined) {
    throw new Error('부가세율이 설정되지 않았습니다');
  }
  const fulfill = calcFulfillmentFee(marginType, policies, extras);
  const realCost = calcTotalCostForMarginType(marginType, costAmount, extras);

  const paymentRate4 = policies.paymentFee ? policies.paymentFee.rate4 : 0;
  let adRatio4 = extras.adRatio4;
  if ((adRatio4 === undefined || adRatio4 === null) && policies.adCost) {
    adRatio4 = policies.adCost.defaultAdRatio4;
  }
  const adRate4 = adRatio4 ?? 0;
  const returnRate4 = policies.returnRisk ? (policies.returnRisk.returnRate4 ?? 0) : 0;
  const vatRate4 = policies.tax.vatRate4;

  /**
   * 한 가지 수수료 조합에 대한 해. 정확한 유리수로 돌려주고 반올림은 호출자가 한 번만 한다.
   * 분모가 0 이하면 성립하지 않는다 — 비용 합이 100% 를 넘으면 어떤 가격으로도 목표에 못 닿는다.
   */
  function solve(mfeeRate4, mfeeFixed) {
    const S = RATE_SCALE;                       // 1e4
    const vatEffective = BigInt(vatRate4) * (S - BigInt(mfeeRate4));            // scale 1e8
    const rateSum = BigInt(mfeeRate4) + BigInt(paymentRate4) + BigInt(adRate4)
                  + BigInt(returnRate4) + BigInt(targetRate4);                  // scale 1e4
    const denom = S * S - rateSum * S - vatEffective;                           // scale 1e8
    if (denom <= 0n) {
      throw new Error(
        '목표 마진율이 비용 합계를 초과해 가격을 역산할 수 없습니다. ' +
        '목표 마진을 낮추거나 수수료·광고비를 줄여야 합니다.',
      );
    }
    // 정액 수수료는 과세표준을 깎으므로 (1 − 부가세율) 가중치를 준다.
    const numer = (BigInt(realCost) + BigInt(fulfill)) * S
                + BigInt(mfeeFixed) * (S - BigInt(vatRate4));                   // scale 1e4
    // price = (numer/1e4) / (denom/1e8) = numer × 1e4 / denom
    return { num: numer * S, den: denom };
  }

  const mf = policies.marketplaceFee;
  if (!mf) return { price: Number(halfUpDiv(...ratio(solve(0, 0)))), tierIndex: null };
  if (mf.feeType === 'RATE') {
    return { price: Number(halfUpDiv(...ratio(solve(mf.rate4 ?? 0, 0)))), tierIndex: null };
  }
  if (mf.feeType === 'FIXED') {
    return { price: Number(halfUpDiv(...ratio(solve(0, mf.fixedAmount ?? 0)))), tierIndex: null };
  }
  if (mf.feeType === 'TIERED') return solveTiered(mf.tiers ?? [], solve);
  throw new Error(`unknown feeType=${mf.feeType}`);
}

const ratio = (r) => [r.num, r.den];

/**
 * 구간별로 풀고 **자기 구간에 들어오는 해**를 고른다. 원본 `_solve_tiered`.
 *
 * 구간마다 요율이 달라 식 하나로는 풀 수 없다. 각 구간 요율로 풀고 그 해가 그 구간
 * 안인지 확인한다 — 판정은 `applyTieredFee` 와 똑같이 `min <= price < max`.
 * 다르면 역산가로 정방향 계산했을 때 다른 구간이 적용돼 결과가 어긋난다.
 *
 * 어느 구간에서도 성립하지 않으면 **값을 지어내지 않고 거절한다.** 원본에서 TIERED 를
 * 통째로 무시했을 때 수수료가 0인 것처럼 계산됐고, 목표 20% 로 역산한 가격의 실제
 * 마진이 11% 였다 — 판매자는 9%p 를 손해 보면서 그 사실을 모른다.
 */
function solveTiered(tiers, solve) {
  const failures = [];
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const lo = Number(tier.min ?? 0);
    const hi = tier.max === null || tier.max === undefined ? null : Number(tier.max);
    const rate4 = tier.rate4 ?? 0;
    const fixed = tier.fixed ?? 0;
    let price;
    try {
      price = Number(halfUpDiv(...ratio(solve(rate4, fixed))));
    } catch (e) {
      failures.push(e.message);
      continue;
    }
    if (price >= lo && (hi === null || price < hi)) return { price, tierIndex: i };
  }
  if (failures.length) throw new Error(failures[0]);
  throw new Error(
    '구간별 수수료(TIERED)로는 목표 마진을 만족하는 가격을 찾지 못했습니다. ' +
    '구간 경계 근처라 해가 자기 구간 밖으로 나갑니다.',
  );
}

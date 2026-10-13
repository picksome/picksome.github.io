/**
 * calc.js 가 원본 Python(`calculation.py`)과 **한 원도 틀리지 않는지** 검증한다.
 *
 * `expected` 의 값은 원본 모듈을 실제로 실행해 뽑은 것이다(oracle). 손으로 적은
 * 값이 아니다 — 이식본이 원본을 따라가는지 보는 테스트이므로 기대값의 출처가
 * 원본이어야 의미가 있다.
 *
 * 실행:  cd site && node --test tests/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeExpectedMargin,
  reverseCalcPriceForTargetMargin,
} from '../src/lib/calc.js';
import { percentToRate4, parseKrw, rate4ToPercent, halfUpDiv } from '../src/lib/money.js';

// ─── 테스트용 정책 조립 헬퍼 ────────────────────────────────────

/** "0.108" 같은 소수 문자열 → rate4. 테스트 전용(문자열로만 계산). */
function r4(decStr) {
  const neg = decStr.startsWith('-');
  const s = neg ? decStr.slice(1) : decStr;
  const [w, f = ''] = s.split('.');
  const frac = f.padEnd(4, '0').slice(0, 4);
  const v = Number(w) * 10000 + Number(frac);
  return neg ? -v : v;
}

const TAX = (d) => ({ vatRate4: r4(d) });
const MF_RATE = (d, extra = {}) => ({ feeType: 'RATE', rate4: r4(d), ...extra });
const MF_FIXED = (n) => ({ feeType: 'FIXED', fixedAmount: n });
const MF_TIERED = (tiers) => ({ feeType: 'TIERED', tiers });
const PF = (d) => ({ rate4: r4(d) });
const RR = (d) => ({ returnRate4: r4(d) });
const AC = (d) => ({ defaultAdRatio4: r4(d) });
const FF = (inbound, outbound, perDay) => ({
  inboundFee: inbound, outboundFee: outbound, storageFeePerDay: perDay,
});

const TIERS = [
  { min: 0, max: 10000, fixed: 1000 },
  { min: 10000, max: 50000, rate4: r4('0.08') },
  { min: 50000, rate4: r4('0.12') },
];

/** 대부분의 케이스가 쓰는 표준 정책 묶음 */
const STD = (over = {}) => ({
  tax: TAX('0.1'),
  marketplaceFee: MF_RATE('0.108'),
  paymentFee: PF('0.0363'),
  returnRisk: RR('0.02'),
  adCost: AC('0.05'),
  ...over,
});

// ─── 정방향 기대값 (원본 실행 결과) ─────────────────────────────

const FORWARD_CASES = [
  ['rate_full',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000 }, STD(),
    { marketplaceFee: 3240, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2676, marginAmount: 8895, marginRate: '0.2965' }],

  ['fixed_fee',
    { marginType: 'GENERAL_RESELL', costAmount: 3000, salePrice: 9900 },
    STD({ marketplaceFee: MF_FIXED(1000) }),
    { marketplaceFee: 1000, paymentFee: 359, adCost: 495, fulfillmentFee: 0,
      returnRiskCost: 198, vat: 890, marginAmount: 3958, marginRate: '0.3998' }],

  ['tiered_low',
    { marginType: 'GENERAL_RESELL', costAmount: 3000, salePrice: 9900 },
    STD({ marketplaceFee: MF_TIERED(TIERS) },),
    { marketplaceFee: 1000, paymentFee: 359, adCost: 495, fulfillmentFee: 0,
      returnRiskCost: 198, vat: 890, marginAmount: 3958, marginRate: '0.3998' }],

  ['tiered_mid',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000 },
    STD({ marketplaceFee: MF_TIERED(TIERS) }),
    { marketplaceFee: 2400, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2760, marginAmount: 9651, marginRate: '0.3217' }],

  ['tiered_high',
    { marginType: 'GENERAL_RESELL', costAmount: 40000, salePrice: 88000 },
    STD({ marketplaceFee: MF_TIERED(TIERS) }),
    { marketplaceFee: 10560, paymentFee: 3194, adCost: 4400, fulfillmentFee: 0,
      returnRiskCost: 1760, vat: 7744, marginAmount: 20342, marginRate: '0.2312' }],

  // 정책이 전부 비어 있을 때 — 산술은 원본대로 0, 단 경고가 떠야 한다
  ['all_policies_none',
    { marginType: 'GENERAL_RESELL', costAmount: 10000, salePrice: 20000 },
    { tax: TAX('0.1') },
    { marketplaceFee: 0, paymentFee: 0, adCost: 0, fulfillmentFee: 0,
      returnRiskCost: 0, vat: 2000, marginAmount: 8000, marginRate: '0.4000' }],

  // 음수 마진 — HALF_UP 이 0 에서 멀어지는 방향인지 확인하는 케이스
  ['negative_margin',
    { marginType: 'GENERAL_RESELL', costAmount: 28000, salePrice: 30001 }, STD(),
    { marketplaceFee: 3240, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2676, marginAmount: -7104, marginRate: '-0.2368' }],

  ['purchase_agency',
    { marginType: 'PURCHASE_AGENCY', costAmount: 20000, salePrice: 59900,
      extras: { agencyFee: 3000, intlShipping: 7500 } },
    STD({ fulfillment: FF(500, 1500, 20) }),
    { marketplaceFee: 6469, paymentFee: 2174, adCost: 2995, fulfillmentFee: 2000,
      returnRiskCost: 1198, vat: 5343, marginAmount: 9221, marginRate: '0.1539' }],

  ['rocket_growth_storage',
    { marginType: 'ROCKET_GROWTH', costAmount: 15000, salePrice: 39900,
      extras: { storageDays: 30 } },
    STD({ fulfillment: FF(500, 1500, 20) }),
    { marketplaceFee: 4309, paymentFee: 1448, adCost: 1995, fulfillmentFee: 2600,
      returnRiskCost: 798, vat: 3559, marginAmount: 10191, marginRate: '0.2554' }],

  ['overseas_direct',
    { marginType: 'OVERSEAS_DIRECT', costAmount: 18000, salePrice: 54900,
      extras: { customs: 1800, fxAdjustment: 900, fulfillmentFee: 2200 } },
    STD({ returnRisk: RR('0.03'), adCost: AC('0.07') }),
    { marketplaceFee: 5929, paymentFee: 1993, adCost: 3843, fulfillmentFee: 2200,
      returnRiskCost: 1647, vat: 4897, marginAmount: 13691, marginRate: '0.2494' }],

  // 광고비 우선순위: 원 직접 입력이 비율보다 이긴다
  ['ad_cost_direct_wins',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000,
      extras: { adCost: 777, adRatio4: r4('0.9') } }, STD(),
    { marketplaceFee: 3240, paymentFee: 1089, adCost: 777, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2676, marginAmount: 9618, marginRate: '0.3206' }],

  ['ad_ratio_override',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000,
      extras: { adRatio4: r4('0.1234') } }, STD(),
    { marketplaceFee: 3240, paymentFee: 1089, adCost: 3702, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2676, marginAmount: 6693, marginRate: '0.2231' }],

  // 마켓수수료를 갈아끼우면 과세표준이 움직이므로 부가세도 재계산돼야 한다
  ['override_mfee_recomputes_vat',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000,
      overrideFields: { marketplaceFee: 5000 } }, STD(),
    { marketplaceFee: 5000, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2500, marginAmount: 7311, marginRate: '0.2437' }],

  // 단, 부가세를 명시적으로 넣었으면 사용자 값이 우선
  ['override_mfee_and_vat',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000,
      overrideFields: { marketplaceFee: 5000, vat: 100 } }, STD(),
    { marketplaceFee: 5000, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 100, marginAmount: 9711, marginRate: '0.3237' }],

  ['needs_review',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000 },
    STD({ marketplaceFee: MF_RATE('0.108', { reliabilityStatus: 'NEEDS_REVIEW' }) }),
    { marketplaceFee: 3240, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 2676, marginAmount: 8895, marginRate: '0.2965' }],

  ['vat_zero',
    { marginType: 'GENERAL_RESELL', costAmount: 12000, salePrice: 30000 },
    STD({ tax: TAX('0'), marketplaceFee: MF_FIXED(1000) }),
    { marketplaceFee: 1000, paymentFee: 1089, adCost: 1500, fulfillmentFee: 0,
      returnRiskCost: 600, vat: 0, marginAmount: 13811, marginRate: '0.4604' }],

  // 반올림이 몰리는 숫자들
  ['rounding_odd',
    { marginType: 'GENERAL_RESELL', costAmount: 3333, salePrice: 7777 },
    STD({ marketplaceFee: MF_RATE('0.0333'), paymentFee: PF('0.0115'),
          returnRisk: RR('0.0125'), adCost: AC('0.0175') }),
    { marketplaceFee: 259, paymentFee: 89, adCost: 136, fulfillmentFee: 0,
      returnRiskCost: 97, vat: 752, marginAmount: 3111, marginRate: '0.4000' }],

  // 억 단위 — Number 안전범위를 넘기지 않는지
  ['big_numbers',
    { marginType: 'GENERAL_RESELL', costAmount: 48000000, salePrice: 99000000 }, STD(),
    { marketplaceFee: 10692000, paymentFee: 3593700, adCost: 4950000, fulfillmentFee: 0,
      returnRiskCost: 1980000, vat: 8830800, marginAmount: 20953500, marginRate: '0.2117' }],
];

for (const [name, input, policies, expected] of FORWARD_CASES) {
  test(`정방향 ${name} — 원본과 일치`, () => {
    const got = computeExpectedMargin(input, policies);
    for (const key of ['marketplaceFee', 'paymentFee', 'adCost', 'fulfillmentFee',
                       'returnRiskCost', 'vat', 'marginAmount']) {
      assert.equal(got[key], expected[key], `${name}.${key}`);
    }
    assert.equal(got.marginRate4, r4(expected.marginRate), `${name}.marginRate`);
  });
}

// ─── 역산 기대값 (원본 실행 결과) ───────────────────────────────

const REVERSE_CASES = [
  ['rev_rate', '0.2', 12000, 'GENERAL_RESELL', STD(), {},
    { price: 24169, roundtrip: '0.2000' }],

  // 정액 수수료 × (1 − vat_rate) 가중치가 들어간 케이스. 이게 빠지면 값이 커진다.
  ['rev_fixed_vat_weight', '0.2', 12000, 'GENERAL_RESELL',
    STD({ marketplaceFee: MF_FIXED(1000) }), {},
    { price: 21728, roundtrip: '0.2000' }],

  // 같은 조건에서 부가세 0% → 가중치가 1 이 되어 결과가 달라야 한다
  ['rev_fixed_vat_zero', '0.2', 12000, 'GENERAL_RESELL',
    STD({ tax: TAX('0'), marketplaceFee: MF_FIXED(1000) }), {},
    { price: 18740, roundtrip: '0.2000' }],

  ['rev_tiered', '0.2', 12000, 'GENERAL_RESELL',
    STD({ marketplaceFee: MF_TIERED(TIERS) }), {},
    { price: 23002, roundtrip: '0.2000' }],

  // 1만원 미만 구간(정액 1000원)에서 풀리는 해
  ['rev_tiered_low', '0.15', 2000, 'GENERAL_RESELL',
    STD({ marketplaceFee: MF_TIERED(TIERS) }), {},
    { price: 4505, roundtrip: '0.1498' }],

  ['rev_no_mfee_policy', '0.25', 10000, 'GENERAL_RESELL', { tax: TAX('0.1') }, {},
    { price: 15385, roundtrip: '0.2500' }],

  ['rev_purchase_agency', '0.18', 20000, 'PURCHASE_AGENCY',
    STD({ fulfillment: FF(500, 1500, 20) }),
    { agencyFee: 3000, intlShipping: 7500, storageDays: 10 },
    { price: 63311, roundtrip: '0.1800' }],

  ['rev_ad_override', '0.2', 12000, 'GENERAL_RESELL', STD(),
    { adRatio4: r4('0.1234') },
    { price: 28362, roundtrip: '0.2000' }],
];

for (const [name, target, cost, mt, policies, extras, expected] of REVERSE_CASES) {
  test(`역산 ${name} — 원본과 일치 + 왕복 검증`, () => {
    const { price } = reverseCalcPriceForTargetMargin(r4(target), cost, mt, policies, extras);
    assert.equal(price, expected.price, `${name}.price`);

    // 역산가로 정방향 계산 → 목표 마진율이 실제로 나오는가
    const fwd = computeExpectedMargin({ marginType: mt, costAmount: cost, salePrice: price, extras }, policies);
    assert.equal(fwd.marginRate4, r4(expected.roundtrip), `${name}.roundtrip`);
  });
}

// ─── 거절해야 하는 경우 — 값을 지어내지 않는다 ──────────────────

test('역산: 목표 마진이 비용 합을 넘으면 거절한다', () => {
  assert.throws(
    () => reverseCalcPriceForTargetMargin(r4('0.85'), 12000, 'GENERAL_RESELL', STD(), {}),
    /초과/,
  );
});

test('역산: TIERED 에서 어느 구간에도 해가 없으면 값을 만들지 않고 거절한다', () => {
  // 1만~2만원이 비어 있는 구간표 — 해가 그 틈에 떨어진다
  const gapped = STD({
    marketplaceFee: MF_TIERED([
      { min: 0, max: 10000, rate4: r4('0.05') },
      { min: 20000, rate4: r4('0.10') },
    ]),
  });
  assert.throws(
    () => reverseCalcPriceForTargetMargin(r4('0.2'), 7000, 'GENERAL_RESELL', gapped, {}),
    /찾지 못했습니다/,
  );
});

test('정방향: 판매가가 0 이하면 거절한다', () => {
  assert.throws(() => computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 100, salePrice: 0 }, STD()), /판매가/);
});

test('정방향: 부가세율이 없으면 0 으로 뭉개지 않고 거절한다', () => {
  assert.throws(() => computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 100, salePrice: 1000 },
    { marketplaceFee: MF_RATE('0.1') }), /부가세율/);
});

// ─── "0원" 과 "모른다" 의 구분 ──────────────────────────────────

test('정책이 비어 있으면 UNKNOWN 으로 표시하고 무엇이 빠졌는지 알려준다', () => {
  const got = computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 10000, salePrice: 20000 },
    { tax: TAX('0.1') });
  assert.equal(got.confidence, 'UNKNOWN');
  assert.deepEqual(got.missingPolicies, ['마켓 수수료', '결제 수수료', '광고비', '반품률']);
  assert.match(got.warnings[0], /0원으로 계산/);
});

test('수수료가 실제로 0%인 것은 UNKNOWN 이 아니다', () => {
  const got = computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 10000, salePrice: 20000 },
    { tax: TAX('0.1'), marketplaceFee: MF_RATE('0'), paymentFee: PF('0'),
      adCost: AC('0'), returnRisk: RR('0') });
  assert.equal(got.confidence, 'ACTUAL');
  assert.deepEqual(got.missingPolicies, []);
  assert.equal(got.marketplaceFee, 0);
});

test('GENERAL_RESELL 은 물류비 정책이 없어도 누락으로 잡지 않는다 (구조상 0)', () => {
  const got = computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 10000, salePrice: 20000 }, STD());
  assert.equal(got.fulfillmentFee, 0);
  assert.deepEqual(got.missingPolicies, []);
  assert.equal(got.confidence, 'ACTUAL');
});

test('ROCKET_GROWTH 는 물류비 정책이 없으면 누락으로 잡는다', () => {
  const got = computeExpectedMargin(
    { marginType: 'ROCKET_GROWTH', costAmount: 10000, salePrice: 20000 }, STD());
  assert.deepEqual(got.missingPolicies, ['물류비']);
});

test('물류비를 정책 대신 직접 입력했으면 누락이 아니다', () => {
  const got = computeExpectedMargin(
    { marginType: 'PURCHASE_AGENCY', costAmount: 10000, salePrice: 20000,
      extras: { fulfillmentFee: 2500 } }, STD());
  assert.equal(got.fulfillmentFee, 2500);
  assert.deepEqual(got.missingPolicies, []);
});

test('물류비 0원을 명시적으로 입력한 것도 누락이 아니다 (0 ≠ 모름)', () => {
  const got = computeExpectedMargin(
    { marginType: 'PURCHASE_AGENCY', costAmount: 10000, salePrice: 20000,
      extras: { fulfillmentFee: 0 } }, STD());
  assert.equal(got.fulfillmentFee, 0);
  assert.deepEqual(got.missingPolicies, []);
});

test('광고비를 직접 입력하면 광고비 정책이 없어도 누락이 아니다', () => {
  const got = computeExpectedMargin(
    { marginType: 'GENERAL_RESELL', costAmount: 10000, salePrice: 20000,
      extras: { adCost: 1500 } },
    { tax: TAX('0.1'), marketplaceFee: MF_RATE('0.1'), paymentFee: PF('0.03'),
      returnRisk: RR('0.02') });
  assert.equal(got.adCost, 1500);
  assert.deepEqual(got.missingPolicies, []);
});

// ─── money.js 단위 ─────────────────────────────────────────────

test('halfUpDiv: HALF_UP 은 0 에서 멀어진다 (Math.round 와 다름)', () => {
  assert.equal(halfUpDiv(5n, 10n), 1n);     //  0.5 →  1
  assert.equal(halfUpDiv(-5n, 10n), -1n);   // -0.5 → -1  (Math.round 는 -0)
  assert.equal(halfUpDiv(4n, 10n), 0n);
  assert.equal(halfUpDiv(-4n, 10n), 0n);
  assert.equal(halfUpDiv(15n, 10n), 2n);
  assert.equal(halfUpDiv(25n, 10n), 3n);    // HALF_UP 은 3 (은행가반올림이면 2)
});

test('percentToRate4: 퍼센트 문자열을 float 없이 rate4 로', () => {
  assert.equal(percentToRate4('10.8'), 1080);
  assert.equal(percentToRate4('3.63'), 363);
  assert.equal(percentToRate4('10'), 1000);
  assert.equal(percentToRate4('0'), 0);
  assert.equal(percentToRate4('.5'), 50);
  assert.equal(percentToRate4('12.34'), 1234);
});

test('percentToRate4: 빈 값은 0%가 아니라 "모른다"(null)', () => {
  assert.equal(percentToRate4(''), null);
  assert.equal(percentToRate4('   '), null);
  assert.equal(percentToRate4(null), null);
  assert.equal(percentToRate4(undefined), null);
});

test('percentToRate4: 표현할 수 없는 정밀도는 조용히 버리지 않고 거절한다', () => {
  assert.throws(() => percentToRate4('1.234'), /소수 둘째 자리/);
  assert.throws(() => percentToRate4('abc'), /읽을 수 없습니다/);
});

test('rate4ToPercent: 왕복', () => {
  assert.equal(rate4ToPercent(1080), '10.8');
  assert.equal(rate4ToPercent(363), '3.63');
  assert.equal(rate4ToPercent(1000), '10');
  assert.equal(rate4ToPercent(0), '0');
});

test('parseKrw: 콤마 허용, 소수점 거절, 빈 값은 null', () => {
  assert.equal(parseKrw('1,234,567'), 1234567);
  assert.equal(parseKrw('0'), 0);
  assert.equal(parseKrw(''), null);
  assert.throws(() => parseKrw('1000.5'), /정수/);
  assert.throws(() => parseKrw('천원'), /읽을 수 없습니다/);
});

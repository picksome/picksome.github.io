/**
 * 화면 입력 → 계산 입력 변환. 도구 페이지 세 개가 같은 필드 이름을 쓰므로
 * 읽는 코드도 한 곳에 둔다. (같은 폼을 세 번 다시 쓰면 세 번 다르게 틀린다)
 *
 * 규칙: **빈칸은 0 이 아니라 `null`(모름)** 으로 돌려준다. 0 으로 바꾸는 판단은
 * 계산 쪽이 하고, 그때 경고를 띄운다. 여기서 뭉개면 그 기회가 사라진다.
 */

import { parseKrw, percentToRate4 } from './money.js';

/** 입력 하나를 읽는다. 잘못된 값이면 어느 칸인지 알려주는 에러를 던진다. */
function read(form, name, parser, label) {
  const el = form.elements[name];
  if (!el) return null;
  try {
    return parser(el.value);
  } catch (e) {
    throw new Error(`${label ?? name}: ${e.message}`);
  }
}

const krw = (form, name, label) => read(form, name, parseKrw, label);
const pct = (form, name, label) => read(form, name, percentToRate4, label);

/** 빈칸을 0 으로 보되, 어떤 칸이 비어 있었는지 기록한다. */
function krwOr0(form, name) {
  const v = krw(form, name);
  return v === null ? 0 : v;
}

/**
 * 정책 묶음 조립. 비어 있는 칸은 그 정책을 아예 `undefined` 로 둔다 —
 * 그러면 `computeExpectedMargin` 이 "모름"으로 잡아 경고를 붙인다.
 */
export function collectPolicies(form) {
  const mfee4 = pct(form, 'mfeeRate', '마켓 수수료율');
  const pfee4 = pct(form, 'pfeeRate', '결제 수수료율');
  const ret4 = pct(form, 'returnRate', '반품률');
  const vat4 = pct(form, 'vatRate', '부가세율');
  const ad4 = pct(form, 'adRate', '광고비 비율');

  if (vat4 === null) throw new Error('부가세율을 입력하세요. (일반과세자는 10)');

  const policies = { tax: { vatRate4: vat4 } };
  if (mfee4 !== null) policies.marketplaceFee = { feeType: 'RATE', rate4: mfee4 };
  if (pfee4 !== null) policies.paymentFee = { rate4: pfee4 };
  if (ret4 !== null) policies.returnRisk = { returnRate4: ret4 };
  if (ad4 !== null) policies.adCost = { defaultAdRatio4: ad4 };

  const marginType = form.elements.marginType?.value ?? 'GENERAL_RESELL';
  if (marginType === 'ROCKET_GROWTH') {
    policies.fulfillment = {
      inboundFee: krwOr0(form, 'inboundFee'),
      outboundFee: krwOr0(form, 'outboundFee'),
      storageFeePerDay: krwOr0(form, 'storagePerDay'),
    };
  }
  return policies;
}

/** 마진 유형별 추가 비용. 입력하지 않은 항목은 넣지 않는다. */
export function collectExtras(form) {
  const marginType = form.elements.marginType?.value ?? 'GENERAL_RESELL';
  const extras = {};

  if (marginType === 'PURCHASE_AGENCY') {
    extras.agencyFee = krwOr0(form, 'agencyFee');
    extras.intlShipping = krwOr0(form, 'intlShipping');
  } else if (marginType === 'OVERSEAS_DIRECT') {
    extras.customs = krwOr0(form, 'customs');
    extras.fxAdjustment = krwOr0(form, 'fxAdjustment');
  } else if (marginType === 'ROCKET_GROWTH') {
    extras.storageDays = krwOr0(form, 'storageDays');
  }

  // 물류비 직접 입력 — ROCKET_GROWTH 는 위에서 정책으로 계산하므로 여기선 제외.
  if (marginType !== 'ROCKET_GROWTH' && marginType !== 'GENERAL_RESELL') {
    const direct = krw(form, 'fulfillDirect', '물류·배송 대행비');
    if (direct !== null) extras.fulfillmentFee = direct;
  }

  // 광고비를 원으로 직접 넣었으면 비율보다 우선한다 (원본 우선순위).
  const adDirect = krw(form, 'adCostDirect', '광고비(원)');
  if (adDirect !== null) extras.adCost = adDirect;

  return { marginType, extras };
}

/** 금액 입력칸에 콤마를 넣어 준다. 커서 위치는 끝으로 간다 (간단함 우선). */
export function attachThousandsFormatting(root) {
  for (const el of root.querySelectorAll('input[data-krw]')) {
    el.addEventListener('input', () => {
      const digits = el.value.replace(/[^\d-]/g, '');
      if (digits === '' || digits === '-') { el.value = digits; return; }
      const n = Number(digits);
      if (!Number.isSafeInteger(n)) return;
      el.value = n.toLocaleString('ko-KR');
    });
  }
}

/** 에러·경고 영역 렌더 */
export function showError(el, message) {
  el.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'note err';
  div.innerHTML = '<strong>입력을 확인하세요</strong><p></p>';
  div.querySelector('p').textContent = message;
  el.appendChild(div);
  el.hidden = false;
}

export function showWarnings(el, warnings) {
  el.innerHTML = '';
  if (!warnings.length) { el.hidden = true; return; }
  const div = document.createElement('div');
  div.className = 'note warn';
  div.innerHTML = '<strong>주의</strong>';
  const ul = document.createElement('ul');
  for (const w of warnings) {
    const li = document.createElement('li');
    li.textContent = w;
    ul.appendChild(li);
  }
  div.appendChild(ul);
  el.appendChild(div);
  el.hidden = false;
}

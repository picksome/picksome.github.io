/**
 * 금액 계산 헬퍼 — Ops Tool `backend/app/core/money.py` 의 이식본.
 *
 * 원본 원칙을 그대로 가져온다:
 *   - float 절대 사용 금지
 *   - 금액은 원 단위 정수, 비율은 Decimal(NUMERIC(7,4))
 *
 * JS 에는 Decimal 이 없으므로 **비율을 1/10000 단위 정수**(이하 `rate4`)로 표현한다.
 * NUMERIC(7,4) = 소수 4자리이므로 rate4 로 원본 정밀도를 손실 없이 담을 수 있다.
 *   0.108 (10.8%)  →  rate4 = 1080
 *
 * 중간 계산은 BigInt 로 한다. 원가 1억원대에 1e8 스케일을 곱하면 Number 의
 * 안전 정수 범위(9.007e15)를 넘기기 때문이다. 넘기는 순간 조용히 오차가 생기고
 * 그건 정확히 이 프로젝트가 금지한 float 의 실패 방식이다.
 */

/** 비율 스케일. rate4 = 실제비율 × 10000 */
export const RATE_SCALE = 10000n;

/**
 * `n / d` 를 ROUND_HALF_UP 으로 정수화. Python `Decimal.quantize(1, ROUND_HALF_UP)` 과 동일.
 *
 * HALF_UP 은 0 에서 **멀어지는** 방향으로 올린다 (-0.5 → -1). JS 의 `Math.round`
 * 는 -0.5 → -0 이라 다르다. 마진은 음수가 될 수 있으므로 이 차이가 실제로 난다.
 */
export function halfUpDiv(n, d) {
  if (d <= 0n) throw new Error('halfUpDiv: 분모는 양수여야 합니다');
  if (n >= 0n) return (2n * n + d) / (2n * d);
  return -((2n * -n + d) / (2n * d));
}

/** Decimal → KRW 정수. 원본 `to_krw`. */
export function toKrw(scaledValue, scale) {
  return Number(halfUpDiv(scaledValue, scale));
}

/** 원본 `apply_rate(amount, rate)` — amount 에 비율 적용 후 정수 원. */
export function applyRate(amount, rate4) {
  if (rate4 === null || rate4 === undefined) return 0;
  return Number(halfUpDiv(BigInt(amount) * BigInt(rate4), RATE_SCALE));
}

/**
 * 비율을 소수 4자리로 양자화. 원본 `quantize_rate`.
 * 반환은 rate4 정수 — 표시 직전에만 문자열로 바꾼다.
 */
export function quantizeRate4(numerator, denominator) {
  if (denominator === 0n) throw new Error('quantizeRate4: 분모 0');
  const neg = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = Number(halfUpDiv(n * RATE_SCALE, d));
  return neg ? -q : q;
}

// ─── 입출력 변환 (UI 경계에서만 사용) ──────────────────────────────

/**
 * 사용자가 입력한 퍼센트 문자열 → rate4. **float 를 거치지 않고** 문자열로 파싱한다.
 *   "10.8"  → 1080      (10.8% = 0.108)
 *   "3.63"  → 363
 *   "0"     → 0
 *   ""/null → null      ← "0%" 가 아니라 "모른다". 호출자가 구분해야 한다.
 *
 * 퍼센트는 소수 둘째 자리까지만 받는다 (그 이상은 rate4 로 표현할 수 없다).
 */
export function percentToRate4(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim();
  if (s === '') return null;
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) {
    throw new Error(`숫자로 읽을 수 없습니다: "${text}"`);
  }
  const sign = m[1] === '-' ? -1 : 1;
  const whole = m[2] === '' ? '0' : m[2];
  const frac = (m[3] ?? '').padEnd(2, '0');
  if (frac.length > 2) {
    throw new Error(`퍼센트는 소수 둘째 자리까지만 입력할 수 있습니다: "${text}"`);
  }
  return sign * Number(whole + frac);
}

/** rate4 → 퍼센트 표시 문자열. "1080" → "10.8" */
export function rate4ToPercent(rate4, maxFractionDigits = 2) {
  if (rate4 === null || rate4 === undefined) return '';
  const neg = rate4 < 0;
  const v = Math.abs(rate4);
  const whole = Math.trunc(v / 100);
  const frac = String(v % 100).padStart(2, '0').replace(/0+$/, '');
  const shown = frac.slice(0, maxFractionDigits);
  return `${neg ? '-' : ''}${whole}${shown ? '.' + shown : ''}`;
}

/** 금액 입력 문자열 → 정수 원. 콤마 허용. 빈 값은 null(= 모른다). */
export function parseKrw(text) {
  if (text === null || text === undefined) return null;
  const s = String(text).trim().replace(/,/g, '');
  if (s === '') return null;
  if (!/^-?\d+$/.test(s)) {
    if (/^-?\d+\.\d+$/.test(s)) {
      throw new Error('금액은 원 단위 정수로 입력하세요 (소수점 불가)');
    }
    throw new Error(`금액으로 읽을 수 없습니다: "${text}"`);
  }
  return Number(s);
}

/** 정수 원 → "1,234,567" */
export function formatKrw(amount) {
  if (amount === null || amount === undefined) return '—';
  return amount.toLocaleString('ko-KR');
}

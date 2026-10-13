/**
 * 마켓·결제 수수료 기본값.
 *
 * ⚠️ 여기 있는 값은 **전부 추정치(ESTIMATED)** 다. 공개된 수수료 구간의 대표값일 뿐,
 * 실제 요율은 카테고리·계약·프로모션에 따라 다르다. 그래서
 *   1) 화면에서 모두 수정할 수 있게 하고,
 *   2) 추정치라는 사실을 숨기지 않고 배지로 표시하고,
 *   3) `verifyAt` 에 사용자가 직접 확인할 곳을 적어 둔다.
 *
 * 이 원칙은 원본 Ops Tool 의 `reliability_status` / `confidence` 와 같은 생각이다 —
 * **모르는 값을 아는 값처럼 보이게 만들지 않는다.**
 */

/** 이 표를 마지막으로 점검한 시점. 오래되면 화면에 "확인하세요"를 띄운다. */
export const PRESET_AS_OF = '2026-10';

export const CONFIDENCE_LABEL = {
  ACTUAL: '실제값',
  ESTIMATED: '추정값',
  UNKNOWN: '모름',
};

/**
 * 마켓별 판매수수료.
 * `typicalRate4` 는 구간의 대표값이다. `rangeText` 를 화면에 같이 보여줘서
 * 사용자가 "내 카테고리는 다르겠구나"를 바로 알게 한다.
 *
 * `paymentIncluded: true` 인 마켓은 판매수수료에 결제수수료가 이미 들어 있다.
 * 모르고 결제수수료를 또 넣으면 **이중 계산**이 된다 — UI 가 경고해야 한다.
 */
export const MARKETPLACES = [
  {
    id: 'COUPANG',
    name: '쿠팡 (마켓플레이스)',
    feeType: 'RATE',
    typicalRate4: 1080,
    rangeText: '카테고리별 약 4 ~ 10.8%',
    paymentIncluded: true,
    note: '판매수수료에 결제 수수료가 포함된 구조다. 아래 결제 수수료는 0으로 두는 것이 맞다.',
    verifyAt: '쿠팡 윙 → 판매자 수수료 안내',
  },
  {
    id: 'NAVER',
    name: '네이버 스마트스토어',
    feeType: 'RATE',
    typicalRate4: 585,
    rangeText: '주문관리 약 2% + 쇼핑 매출연동 2% ≒ 3.5 ~ 5.85%',
    paymentIncluded: true,
    note: '주문관리수수료 자체가 결제수수료 역할을 한다. 결제 수수료를 따로 넣으면 이중 계산이다.',
    verifyAt: '스마트스토어센터 → 정산관리 → 수수료 안내',
  },
  {
    id: 'ELEVEN',
    name: '11번가',
    feeType: 'RATE',
    typicalRate4: 1000,
    rangeText: '카테고리별 약 7 ~ 13%',
    paymentIncluded: true,
    verifyAt: '셀러오피스 → 판매수수료 안내',
  },
  {
    id: 'GMARKET',
    name: 'G마켓',
    feeType: 'RATE',
    typicalRate4: 1000,
    rangeText: '카테고리별 약 6 ~ 13%',
    paymentIncluded: true,
    verifyAt: 'ESM PLUS → 수수료 안내',
  },
  {
    id: 'AUCTION',
    name: '옥션',
    feeType: 'RATE',
    typicalRate4: 1000,
    rangeText: '카테고리별 약 6 ~ 13%',
    paymentIncluded: true,
    verifyAt: 'ESM PLUS → 수수료 안내',
  },
  {
    id: 'OWN_MALL',
    name: '자체 쇼핑몰 (카페24·아임웹 등)',
    feeType: 'RATE',
    typicalRate4: 0,
    rangeText: '판매수수료 0% — 대신 결제(PG) 수수료를 따로 낸다',
    paymentIncluded: false,
    note: '판매수수료가 없으니 아래 결제 수수료를 반드시 채워야 한다. 0으로 두면 마진이 부풀어 보인다.',
    verifyAt: '사용 중인 PG사 계약서',
  },
];

/** 결제(PG) 수수료. 자체몰처럼 판매수수료에 포함되지 않은 경우에 쓴다. */
export const PAYMENT_METHODS = [
  { id: 'NONE', name: '해당 없음 (판매수수료에 포함)', rate4: 0 },
  { id: 'CARD', name: '신용카드 (일반 PG)', rate4: 330, rangeText: '약 2.0 ~ 3.5%' },
  { id: 'NAVER_PAY', name: '네이버페이 (자체몰 연동)', rate4: 340, rangeText: '약 3.4%' },
  { id: 'KAKAO_PAY', name: '카카오페이', rate4: 320, rangeText: '약 2.9 ~ 3.4%' },
  { id: 'ACCOUNT_TRANSFER', name: '계좌이체·무통장입금', rate4: 150, rangeText: '약 1.0 ~ 1.8%' },
];

/** 부가세. 간이과세·면세 사업자는 달라진다. */
export const TAX_PRESETS = [
  { id: 'GENERAL', name: '일반과세자 (10%)', vatRate4: 1000 },
  { id: 'EXEMPT', name: '면세·영세율 (0%)', vatRate4: 0 },
];

/**
 * 반품률 — 카테고리별 평균. 이것도 추정치다.
 * 0% 로 두면 "반품이 없다"고 가정하는 것이고, 그건 거의 항상 틀린다.
 */
export const RETURN_RATE_PRESETS = [
  { id: 'LOW', name: '낮음 — 생활·식품·소모품 (1%)', returnRate4: 100 },
  { id: 'MID', name: '보통 — 잡화·가전·디지털 (2%)', returnRate4: 200 },
  { id: 'HIGH', name: '높음 — 의류·신발·패션 (8%)', returnRate4: 800 },
];

/** 마진 유형 설명 — 화면 도움말로 쓴다. */
export const MARGIN_TYPE_HELP = {
  PURCHASE_AGENCY: '해외 상품을 주문받아 대신 구매·배송. 구매대행 수수료와 국제배송비가 원가에 더해진다.',
  ROCKET_GROWTH: '쿠팡 물류센터에 입고해 쿠팡이 보관·배송. 입고·출고·보관비가 붙는다.',
  OVERSEAS_DIRECT: '해외에서 직접 매입해 국내 재고로 판매. 관세와 환율 변동이 원가에 들어간다.',
  GENERAL_RESELL: '국내에서 사입해 직접 보관·발송. 물류 대행비가 없다.',
};

/** id 로 프리셋 찾기 */
export const findById = (list, id) => list.find((x) => x.id === id);

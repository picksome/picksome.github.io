/**
 * 사이트 전역 설정 — **이름·연락처를 바꿀 일이 있으면 이 파일만 고치면 된다.**
 * 다른 파일은 전부 여기서 읽어 쓴다.
 */

export const SITE = {
  // 도메인을 사면 astro.config.mjs 의 SITE 도 같이 바꿀 것 (두 곳)
  name: '셀러 계산기',
  tagline: '구매대행·오픈마켓 셀러를 위한 무료 계산 도구',
  description:
    '구매대행 마진, 오픈마켓 수수료, 목표 마진 역산을 브라우저에서 바로 계산합니다. ' +
    '입력한 숫자는 서버로 전송되지 않습니다. 회원가입 없이 무료로 사용하세요.',
  author: 'Picksome',
  // 연락처 — 애드센스 심사에서 확인한다. 실제 쓰는 주소여야 한다.
  email: 'picksome24@gmail.com',
  locale: 'ko-KR',

  // 후원 링크. 비우면 후원 영역이 아예 렌더링되지 않는다.
  // 토스/카카오페이 송금 링크를 받으면 여기에 붙이면 끝이다.
  donate: {
    tossUrl: '',
    kakaoUrl: '',
  },
};

/** 네비게이션에 노출되는 도구 목록. 도구를 추가하면 여기 한 줄만 더하면 된다. */
export const TOOLS = [
  {
    href: '/tools/margin',
    title: '구매대행 마진 계산기',
    short: '마진 계산기',
    summary: '판매가와 원가를 넣으면 수수료·광고비·반품위험·부가세를 빼고 남는 실제 마진을 계산합니다.',
    icon: '￦',
  },
  {
    href: '/tools/fee-compare',
    title: '오픈마켓 수수료 비교',
    short: '수수료 비교',
    summary: '같은 상품을 여러 마켓에 올렸을 때 어디가 가장 많이 남는지 한 화면에서 비교합니다.',
    icon: '⇄',
  },
  {
    href: '/tools/reverse-price',
    title: '목표 마진 판매가 역산',
    short: '판매가 역산',
    summary: '원가와 목표 마진율을 넣으면 그 마진을 만드는 판매가를 거꾸로 계산합니다.',
    icon: '↩',
  },
];

/** 푸터·네비에 들어가는 안내 페이지 */
export const PAGES = [
  { href: '/about', title: '사이트 소개' },
  { href: '/guide', title: '마진 계산 가이드' },
  { href: '/privacy', title: '개인정보처리방침' },
  { href: '/contact', title: '문의' },
];

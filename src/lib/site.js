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

  // 구글 연동. 받은 값을 붙여 넣기만 하면 된다. 비우면 아무것도 렌더링되지 않는다.
  google: {
    // Search Console → 소유권 확인 → "HTML 태그" 의 content="..." 안쪽 값
    siteVerification: '90Gg-doQiHY7J7mK_wltdNOtmKIMOv38O3CEsrwYO6I',
    // 애드센스 게시자 ID. 'ca-pub-1234567890123456' 형태.
    // 넣으면 광고 스크립트·<meta google-adsense-account>·/ads.txt 가 자동으로 생긴다.
    adsenseClient: '',
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

/**
 * /projects 에 소개하는 공개 프로젝트. 코드는 GitHub 에 있고 이 사이트에서는 소개와 링크만 한다.
 * 프로젝트를 추가하면 여기 한 덩어리만 더하면 된다.
 */
export const GITHUB_ORG = 'https://github.com/picksome';
export const PROJECTS = [
  {
    id: 'ops-tool',
    title: 'Picksome Ops Tool',
    subtitle: '셀러 운영 관리 시스템',
    repo: `${GITHUB_ORG}/picksome-ops-tool`,
    summary:
      '상품 소싱·원가·마진부터 재고, 비용, 월별 정산, 세무 리포트까지 한 곳에서 관리하는 웹 애플리케이션입니다.',
    why:
      '엑셀 파일 하나(마진계산기·장부)로 운영하다 보니 시트가 늘어날수록 숫자가 서로 어긋났습니다. 같은 계산이 여러 시트에 복사돼 있어서, 한 곳을 고치면 다른 곳이 틀렸습니다. 업무 흐름과 계산 로직을 다시 설계해 하나의 시스템으로 옮긴 것이 이 프로젝트입니다.',
    features: [
      '상품·소싱·원가·마진 관리, 재고 원장과 발주·입고',
      '비용 입력, 월 마감, 정산·배분·지급 기록',
      '부가세·종합소득세 신고 참고용 리포트(엑셀) 생성',
      '예외 센터와 일일 리포트, 백업·복원',
    ],
    status: '내부 기능은 완성됐고, 쿠팡·네이버·11번가 주문 자동 수집 연동이 남아 있습니다.',
    stack: 'Python(FastAPI) · PostgreSQL · Next.js · Docker',
    relation: '이 사이트의 세 계산기는 이 프로그램의 마진 계산 함수를 브라우저용으로 옮긴 것입니다.',
  },
  {
    id: 'ledger',
    title: 'Next Engine Ledger',
    subtitle: '판매장부 반자동 입력',
    repo: `${GITHUB_ORG}/next-engine-ledger`,
    summary:
      '넥스트엔진에 쌓인 주문을 모아 구글 시트 판매장부에 옮겨 적는 Windows용 자동화 프로그램입니다.',
    why:
      '매일 주문을 장부로 옮기는 일은 단순하지만 실수가 잦습니다. 상품명이 조금만 달라도 다른 행에 적히고, 같은 주문을 두 번 적기도 합니다. 반복 입력은 프로그램이 하고, 사람은 판단이 필요한 부분만 확인하도록 나눴습니다.',
    features: [
      '메신저(텔레그램) 명령 한 번으로 그날 주문 수집 시작',
      '마진계산 시트와 상품·옵션을 대조해 장부 행 작성',
      '도매 사이트 구매내역으로 구매 링크 검증, 중복 입력 검사',
      '애매한 건은 멈추고 사람에게 확인 요청 — 판매처 칸은 사람이 고른 값만 입력',
    ],
    status: '실제 장부 운영에 쓰고 있습니다. 넥스트엔진·구글 계정 설정이 필요해 바로 실행하기는 어렵습니다.',
    stack: 'Python · Playwright · Google Sheets API',
    relation: '이 사이트의 계산기와 같은 구매대행 판매 업무에서, 계산이 끝난 뒤의 기록 단계를 맡습니다.',
  },
  {
    id: 'blogops',
    title: 'BlogOps Studio',
    subtitle: '블로그 콘텐츠 제작 보조 도구',
    repo: `${GITHUB_ORG}/blogops-studio`,
    summary:
      '네이버 블로그와 워드프레스에 올릴 글을 준비하는 과정 — 자료 수집, 글 구조 잡기, 검수 — 을 돕는 도구입니다. 자동으로 글을 발행하지는 않습니다.',
    why:
      '같은 주제라도 네이버와 구글은 좋아하는 글의 모양이 다릅니다. 한 글을 그대로 두 곳에 올리면 양쪽 다 어중간해집니다. 채널별로 구조를 따로 잡고, 올리기 전에 사람이 확인할 항목을 정리해 주도록 만들었습니다.',
    features: [
      '키워드로 관련 뉴스의 제목·요약·출처만 모아 쟁점 정리 (본문 복사 없음)',
      '네이버용·워드프레스용 원고 틀을 따로 생성',
      '채널별 검색 최적화 점검, 기계적인 표현 찾기',
      '얇은 콘텐츠·기사 짜깁기 위험 점검',
    ],
    status: '로컬 PC에서 실행하는 프로그램입니다. 발행 전 사람 검수를 전제로 합니다.',
    stack: 'Python · Streamlit',
    relation: '판매 운영과 별개로, 셀러가 직접 블로그를 운영할 때 쓰려고 만든 도구입니다.',
    license: 'MIT',
  },
];

/** 푸터·네비에 들어가는 안내 페이지 */
export const PAGES = [
  { href: '/about', title: '사이트 소개' },
  { href: '/projects', title: '만든 프로젝트' },
  { href: '/guide', title: '마진 계산 가이드' },
  { href: '/privacy', title: '개인정보처리방침' },
  { href: '/contact', title: '문의' },
];

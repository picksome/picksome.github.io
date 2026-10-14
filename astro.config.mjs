// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// ───────────────────────────────────────────────────────────────
// 도메인을 사면 아래 SITE 한 줄만 바꾸면 된다. 다른 곳은 건드릴 필요 없다.
//   예) const SITE = 'https://margincalc.kr';
// ───────────────────────────────────────────────────────────────
const SITE = 'https://picksome.github.io';

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',
  // /tools/margin → tools/margin.html 로 만든다. 폴더(…/index.html)로 만들면 GitHub Pages 가
  // /tools/margin 을 /tools/margin/ 으로 301 리다이렉트해서 canonical·사이트맵 주소와 어긋난다.
  build: { format: 'file' },
  // 압축하면 "</strong>\n다음 문장" 의 줄바꿈 공백이 사라져 "…니다.다음" 처럼 붙는다. 한국어 본문이라 끈다.
  compressHTML: false,
  // /projects 는 /programs 로 넘기는 옛 주소라 사이트맵에서 뺀다
  integrations: [sitemap({ filter: (page) => !/\/projects\/?$/.test(page) })],
});

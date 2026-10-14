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
  integrations: [sitemap()],
});

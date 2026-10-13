/**
 * robots.txt 를 빌드 시 생성한다. 도메인이 바뀌어도 sitemap 주소가 자동으로 따라간다
 * (astro.config.mjs 의 SITE 한 곳만 고치면 된다).
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const body = `User-agent: *
Allow: /

# 애드센스·광고 크롤러는 광고 품질 판단을 위해 접근해야 한다. 막으면 광고가 안 붙는다.
User-agent: Mediapartners-Google
Allow: /

User-agent: AdsBot-Google
Allow: /

Sitemap: ${new URL('sitemap-index.xml', site).href}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

/**
 * /ads.txt — 애드센스 게시자 ID(site.js 의 google.adsenseClient)가 있을 때만 만들어진다.
 * 직접 고칠 일은 없다.
 */
import { SITE } from '../lib/site.js';

export function getStaticPaths() {
  return SITE.google.adsenseClient ? [{ params: { file: 'ads' } }] : [];
}

export function GET() {
  const pub = SITE.google.adsenseClient.replace(/^ca-/, '');
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

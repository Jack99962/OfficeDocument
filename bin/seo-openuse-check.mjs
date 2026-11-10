import { readFileSync } from 'node:fs';

const failures = [];
const entities = readFileSync('bin/pages/entities.mjs', 'utf8');
const llms = readFileSync('public/llms.txt', 'utf8');
const sitemap = readFileSync('public/sitemap.xml', 'utf8');
const notFound = readFileSync('public/404.html', 'utf8');

for (const [name, url] of [
  ['Quire', 'https://whogogo.com/tool/quire'],
  ['Ledger', 'https://whogogo.com/tool/ledger'],
  ['Lectern', 'https://whogogo.com/tool/lectern'],
]) {
  if (!entities.includes(url)) failures.push(`entity graph missing ${name} OpenUse URL`);
  if (!llms.includes(url)) failures.push(`llms.txt missing ${name} OpenUse URL`);
}

for (const loc of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const url = loc[1];
  if (url !== 'https://word.whogogo.com/' && /\/$/.test(url) && !/^https:\/\/word\.whogogo\.com\/(zh-CN|ja|de|es|ko|pt)\/$/.test(url)) {
    failures.push(`unexpected trailing slash in sitemap: ${url}`);
  }
}
if ((sitemap.match(/<loc>/g) || []).length !== (sitemap.match(/<lastmod>/g) || []).length) failures.push('every sitemap URL must have lastmod');
if (!/noindex(?:, follow)?/.test(notFound)) failures.push('404 page must remain noindex');
if (failures.length) {
  console.error(`OpenUse SEO verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('OpenUse SEO entity and canonical checks passed.');

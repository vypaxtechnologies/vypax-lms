import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_SITE_PAGES, SEO_PAGES, SITE_ORIGIN } from '../src/seo-pages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function updateHead(html, { title, description, url, indexable }) {
  const escapedTitle = escapeHtml(title);
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapedTitle}</title>`);

  const metadata = [
    ['name', 'description', description],
    ['name', 'robots', indexable ? 'index,follow' : 'noindex,follow'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', url],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Vypax Technologies'],
    ['property', 'og:image', `${SITE_ORIGIN}/site/logo.svg`],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description]
  ];

  for (const [attribute, name, value] of metadata) {
    const element = `<meta ${attribute}="${escapeHtml(name)}" content="${escapeHtml(value)}">`;
    const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*>`, 'i');
    if (matcher.test(html)) {
      html = html.replace(matcher, element);
    } else {
      html = html.replace(/<\/head>/i, `${element}</head>`);
    }
  }

  const canonical = `<link rel="canonical" href="${escapeHtml(url)}">`;
  const canonicalMatcher = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i;
  if (canonicalMatcher.test(html)) {
    html = html.replace(canonicalMatcher, canonical);
  } else {
    html = html.replace(/<\/head>/i, `${canonical}</head>`);
  }
  return html;
}

const sitemapPaths = new Set();
const siteFiles = new Set(ALL_SITE_PAGES.map(page => page.file));
if (siteFiles.size !== ALL_SITE_PAGES.length) {
  throw new Error('SEO page manifest contains duplicate page files.');
}

for (const page of SEO_PAGES) {
  const url = new URL(page.path, SITE_ORIGIN);
  if (url.origin !== SITE_ORIGIN || url.search || url.hash || sitemapPaths.has(url.href)) {
    throw new Error(`Invalid or duplicate sitemap URL: ${url.href}`);
  }
  sitemapPaths.add(url.href);

  const pageFile = path.join(output, 'site', page.file);
  const sourceHtml = await readFile(pageFile, 'utf8');
  await writeFile(pageFile, updateHead(sourceHtml, { ...page, url: url.href, indexable: true }));
}

for (const page of ALL_SITE_PAGES) {
  if (SEO_PAGES.includes(page)) continue;
  const pageFile = path.join(output, 'site', page.file);
  const sourceHtml = await readFile(pageFile, 'utf8');
  const description = (sourceHtml.match(/<meta\b(?=[^>]*\bname=["']description["'])[^>]*\bcontent=["']([^"']*)["'][^>]*>/i) || [])[1] || '';
  await writeFile(pageFile, updateHead(sourceHtml, {
    title: page.title,
    description,
    url: new URL(page.path, SITE_ORIGIN).href,
    indexable: false
  }));
}

const shell = await readFile(path.join(output, 'index.html'), 'utf8');
for (const page of ALL_SITE_PAGES) {
  if (page.file === 'index.html') continue;
  const url = new URL(page.path, SITE_ORIGIN).href;
  const description = SEO_PAGES.includes(page) ? page.description : '';
  const html = updateHead(shell, { ...page, description, url, indexable: SEO_PAGES.includes(page) });
  await writeFile(path.join(output, page.file), html);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...sitemapPaths].map(url => `  <url><loc>${escapeXml(url)}</loc></url>`),
  '</urlset>',
  ''
].join('\n');
await writeFile(path.join(output, 'sitemap.xml'), sitemap);

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /account',
  'Disallow: /account.html',
  'Disallow: /admin',
  'Disallow: /admin.html',
  'Disallow: /portal',
  'Disallow: /portal.html',
  'Disallow: /site/account',
  'Disallow: /site/account.html',
  'Disallow: /site/admin',
  'Disallow: /site/admin.html',
  'Disallow: /site/portal',
  'Disallow: /site/portal.html',
  'Disallow: /api/',
  `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ''
].join('\n');
await writeFile(path.join(output, 'robots.txt'), robots);

console.log(`Generated ${SEO_PAGES.length} sitemap URLs, ${ALL_SITE_PAGES.length - 1} page aliases, robots.txt and sitemap.xml.`);

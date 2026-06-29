/**
 * Ajusta dist/ para GitHub Pages: título, manifest PWA e ícones corretos no desktop.
 */
import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const baseUrl = (process.env.EXPO_BASE_URL || '/apptaf').replace(/\/$/, '') || '';
const prefix = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;

const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('patch-web-dist: dist/index.html não encontrado');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, '<title>TAF · Teste de Aptidão Física</title>');
html = html.replace(/<html lang="en">/, '<html lang="pt-BR">');

const headInject = `
    <meta name="description" content="Sistema TAF — Teste de Aptidão Física" />
    <meta name="theme-color" content="#1C1C22" />
    <link rel="manifest" href="${prefix}/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="${prefix}/assets/icon.png" />
`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${headInject}\n  </head>`);
}

const faviconPng = path.join(distDir, 'assets', 'icon.png');
const faviconLink = `<link rel="icon" type="image/png" href="${prefix}/favicon.ico" />`;
if (!html.includes('type="image/png"')) {
  html = html.replace(/<link rel="icon"[^>]*>/, faviconLink);
}

fs.writeFileSync(indexPath, html);

const manifest = {
  name: 'TAF — Teste de Aptidão Física',
  short_name: 'TAF',
  description: 'Sistema TAF — Teste de Aptidão Física',
  start_url: `${prefix}/`,
  scope: `${prefix}/`,
  display: 'standalone',
  background_color: '#1C1C22',
  theme_color: '#1C1C22',
  lang: 'pt-BR',
  icons: [
    {
      src: `${prefix}/favicon.ico`,
      sizes: '48x48',
      type: 'image/x-icon',
    },
  ],
};

if (fs.existsSync(faviconPng)) {
  manifest.icons.push({
    src: `${prefix}/assets/icon.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  });
}

fs.writeFileSync(
  path.join(distDir, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2),
);

// Evita Jekyll no GitHub Pages (senão o README vira a página inicial)
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

function walkDistFiles(dir, relBase = '') {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'sw.js') continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkDistFiles(abs, rel));
    } else {
      out.push(`${prefix}/${rel.replace(/\\/g, '/')}`);
    }
  }
  return out;
}

const precacheUrls = [
  `${prefix}/`,
  `${prefix}/index.html`,
  `${prefix}/manifest.webmanifest`,
  `${prefix}/favicon.ico`,
  ...walkDistFiles(distDir),
].filter((url, index, arr) => arr.indexOf(url) === index);

const swSource = `/* eslint-disable no-restricted-globals */
/* Gerado por scripts/patch-web-dist.mjs — não editar em dist/ */
const CACHE = 'taf-app-shell-${Date.now()}';
const BASE = '${prefix}';

const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
}

function isNavigation(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function shellFallback() {
  return caches.match(BASE + '/index.html').then((hit) => hit || caches.match(BASE + '/'));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { request } = event;
  const url = request.url;

  if (!isSameOrigin(url)) return;

  if (isNavigation(request)) {
    event.respondWith(
      shellFallback().then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                const clone = response.clone();
                caches.open(CACHE).then((cache) => cache.put(BASE + '/index.html', clone));
              }
              return response;
            })
            .catch(() => shellFallback()),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
`;

fs.writeFileSync(path.join(distDir, 'sw.js'), swSource);

const swSrc = path.resolve('public/sw.js');
if (fs.existsSync(swSrc)) {
  // Mantém public/sw.js como referência para dev; produção usa o gerado acima.
}

console.log('patch-web-dist: OK', prefix, `(${precacheUrls.length} assets no SW)`);

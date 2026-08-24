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

// PWA: sem zoom — app sempre enquadrado na tela
const viewportContent =
  'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
if (/<meta\s+name="viewport"[^>]*>/i.test(html)) {
  html = html.replace(
    /<meta\s+name="viewport"[^>]*>/i,
    `<meta name="viewport" content="${viewportContent}" />`,
  );
} else {
  html = html.replace('<head>', `<head>\n    <meta name="viewport" content="${viewportContent}" />`);
}

const headInject = `
    <meta name="description" content="Sistema TAF — Teste de Aptidão Física" />
    <meta name="theme-color" content="#000000" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="TAF" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="manifest" href="${prefix}/manifest.webmanifest" />
    <link rel="icon" type="image/png" sizes="192x192" href="${prefix}/assets/icon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="${prefix}/assets/icon-512.png" />
    <link rel="apple-touch-icon" href="${prefix}/assets/icon-512.png" />
    <style id="taf-pwa-no-zoom">
      html, body, #root {
        height: 100%;
        width: 100%;
        margin: 0;
        overflow: hidden;
        touch-action: manipulation;
        -ms-touch-action: manipulation;
        overscroll-behavior: none;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      body {
        position: fixed;
        inset: 0;
        height: 100dvh;
      }
    </style>
`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${headInject}\n  </head>`);
} else if (!html.includes('taf-pwa-no-zoom')) {
  html = html.replace('</head>', `    <style id="taf-pwa-no-zoom">
      html, body, #root {
        height: 100%;
        width: 100%;
        margin: 0;
        overflow: hidden;
        touch-action: manipulation;
        -ms-touch-action: manipulation;
        overscroll-behavior: none;
        -webkit-text-size-adjust: 100%;
        text-size-adjust: 100%;
      }
      body {
        position: fixed;
        inset: 0;
        height: 100dvh;
      }
    </style>\n  </head>`);
}

// Copia ícones oficiais ANTES de escrever o manifest (senão o Android cai no favicon.ico 48px).
const assetsSrc = path.resolve('assets');
const distAssets = path.join(distDir, 'assets');
fs.mkdirSync(distAssets, { recursive: true });

function copyIcon(name) {
  const from = path.join(assetsSrc, name);
  const to = path.join(distAssets, name);
  if (!fs.existsSync(from)) return false;
  fs.copyFileSync(from, to);
  return true;
}

const has192 = copyIcon('icon-192.png');
const has512 = copyIcon('icon-512.png');
copyIcon('icon-maskable-512.png');
const hasLegacy = copyIcon('icon.png');
if (fs.existsSync(path.join(assetsSrc, 'favicon.png'))) {
  fs.copyFileSync(path.join(assetsSrc, 'favicon.png'), path.join(distDir, 'favicon.png'));
}
// Remove favicon.ico 48px do Expo — Android prioriza isso e o atalho fica embaçado.
const legacyIco = path.join(distDir, 'favicon.ico');
if (fs.existsSync(legacyIco)) {
  fs.unlinkSync(legacyIco);
}

const icon192 = path.join(distAssets, 'icon-192.png');
const icon512 = path.join(distAssets, 'icon-512.png');
const iconLegacy = path.join(distAssets, 'icon.png');

html = html.replace(
  /<link rel="icon"[^>]*>/gi,
  `<link rel="icon" type="image/png" sizes="512x512" href="${prefix}/assets/icon-512.png" />`,
);

fs.writeFileSync(indexPath, html);

const manifest = {
  name: 'TAF — Teste de Aptidão Física',
  short_name: 'TAF',
  description: 'Sistema TAF — Teste de Aptidão Física',
  start_url: `${prefix}/`,
  scope: `${prefix}/`,
  display: 'standalone',
  display_override: ['standalone', 'fullscreen'],
  orientation: 'any',
  background_color: '#000000',
  theme_color: '#000000',
  lang: 'pt-BR',
  icons: [],
};

if (has192 && has512 && fs.existsSync(icon192) && fs.existsSync(icon512)) {
  // Apenas purpose "any": no Android, maskable pinta o alpha com preto e recria o fundo.
  manifest.icons.push(
    {
      src: `${prefix}/assets/icon-192.png`,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: `${prefix}/assets/icon-512.png`,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
  );
} else if (hasLegacy && fs.existsSync(iconLegacy)) {
  manifest.icons.push({
    src: `${prefix}/assets/icon.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any',
  });
} else {
  console.error('patch-web-dist: nenhum ícone PWA encontrado em assets/');
  process.exit(1);
}

fs.writeFileSync(
  path.join(distDir, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2),
);

// Evita Jekyll no GitHub Pages (senão o README vira a página inicial)
fs.writeFileSync(path.join(distDir, '.nojekyll'), '');

// Página standalone de agendamento — copia de public/ e injeta credenciais Supabase.
const agendamentoSrc = path.resolve('public/agendamento.html');
const agendamentoDest = path.join(distDir, 'agendamento.html');
if (!fs.existsSync(agendamentoSrc)) {
  console.error('patch-web-dist: public/agendamento.html não encontrado');
  process.exit(1);
}
let agendamentoHtml = fs.readFileSync(agendamentoSrc, 'utf8');
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const buildId = (process.env.GITHUB_SHA || Date.now().toString()).slice(0, 12);
if (supabaseUrl && supabaseKey) {
  // Substitui placeholders sem quebrar aspas no JS
  agendamentoHtml = agendamentoHtml
    .replaceAll('"__SUPABASE_URL__"', JSON.stringify(supabaseUrl))
    .replaceAll('"__SUPABASE_KEY__"', JSON.stringify(supabaseKey))
    .replaceAll('"__BUILD_ID__"', JSON.stringify(buildId))
    .replaceAll('__SUPABASE_URL__', supabaseUrl)
    .replaceAll('__SUPABASE_KEY__', supabaseKey)
    .replaceAll('__BUILD_ID__', buildId);
  console.log('patch-web-dist: credenciais Supabase injetadas em agendamento.html', `(build ${buildId})`);
} else if (process.env.CI) {
  console.error(
    'patch-web-dist: EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY são obrigatórios no CI',
  );
  process.exit(1);
} else {
  console.warn('patch-web-dist: credenciais Supabase ausentes — agendamento.html ficará com placeholders (dev local)');
}
if (agendamentoHtml.includes('__SUPABASE_URL__') || agendamentoHtml.includes('__SUPABASE_KEY__')) {
  if (process.env.CI) {
    console.error('patch-web-dist: placeholders Supabase não substituídos em agendamento.html');
    process.exit(1);
  }
}
fs.writeFileSync(agendamentoDest, agendamentoHtml);
// Também publica /agendamento/ (com barra) para evitar 404 no GitHub Pages
const agendamentoDir = path.join(distDir, 'agendamento');
fs.mkdirSync(agendamentoDir, { recursive: true });
fs.writeFileSync(path.join(agendamentoDir, 'index.html'), agendamentoHtml);

// SPA no GitHub Pages: rotas profundas (ex. /admin/historico) precisam de HTML.
const spaIndex = fs.readFileSync(indexPath);
fs.writeFileSync(path.join(distDir, '404.html'), spaIndex);
const adminHistoricoDir = path.join(distDir, 'admin', 'historico');
fs.mkdirSync(adminHistoricoDir, { recursive: true });
fs.writeFileSync(path.join(adminHistoricoDir, 'index.html'), spaIndex);

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
  `${prefix}/favicon.png`,
  `${prefix}/assets/icon-192.png`,
  `${prefix}/assets/icon-512.png`,
  `${prefix}/assets/icon-maskable-512.png`,
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

  // HTML: network-first — evita tela antiga sem novos botões (PWA cache)
  if (isNavigation(request)) {
    try {
      const pathname = new URL(url).pathname;
      // Página standalone de agendamento: nunca usar SPA como fallback.
      // O service worker passa direto para a rede, sem interceptar.
      if (pathname === BASE + '/agendamento' ||
          pathname === BASE + '/agendamento/' ||
          pathname.startsWith(BASE + '/agendamento?')) {
        return; // deixa o browser buscar normalmente
      }
    } catch { /* se URL for inválida, deixa seguir o fluxo padrão */ }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            // Só atualiza o cache de index.html se for realmente a raiz da SPA.
            const reqPath = (() => { try { return new URL(url).pathname; } catch { return ''; } })();
            if (reqPath === BASE + '/' || reqPath === BASE + '/index.html') {
              caches.open(CACHE).then((cache) => cache.put(BASE + '/index.html', clone));
            }
            caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
            return response;
          }
          return shellFallback();
        })
        .catch(() => shellFallback()),
    );
    return;
  }

  // Assets com hash: cache-first; demais: network-first com fallback
  const isHashedAsset = /\\/_expo\\/static\\//.test(url);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
`;

fs.writeFileSync(path.join(distDir, 'sw.js'), swSource);

const swSrc = path.resolve('public/sw.js');
if (fs.existsSync(swSrc)) {
  // Mantém public/sw.js como referência para dev; produção usa o gerado acima.
}

console.log('patch-web-dist: OK', prefix, `(${precacheUrls.length} assets no SW)`);

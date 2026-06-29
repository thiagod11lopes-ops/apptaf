/* eslint-disable no-restricted-globals */
/**
 * Service worker base (dev). O build de produção gera dist/sw.js com precache
 * completo via scripts/patch-web-dist.mjs (caminho /apptaf no GitHub Pages).
 */
const CACHE = 'taf-app-shell-dev';
const BASE = (() => {
  const scope = self.registration?.scope ?? self.location.origin + '/';
  try {
    const path = new URL(scope).pathname.replace(/\/$/, '');
    return path || '';
  } catch {
    return '';
  }
})();

function withBase(path) {
  if (!path.startsWith('/')) path = `/${path}`;
  return `${BASE}${path}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([withBase('/'), withBase('/index.html')].map((u) => new Request(u, { cache: 'reload' }))),
      )
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
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
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { request } = event;
  const url = request.url;

  if (!isSameOrigin(url)) return;

  if (isNavigation(request)) {
    event.respondWith(
      caches.match(withBase('/index.html')).then(
        (cached) =>
          cached ||
          fetch(request).catch(
            () => caches.match(withBase('/')) || caches.match(withBase('/index.html')),
          ),
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

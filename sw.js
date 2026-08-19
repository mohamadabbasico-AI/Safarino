/* سفرینو service worker - FIX #9 / #10
   v2 built this from a blob: URL, which the spec forbids, so registration
   always failed and there was never any offline support. This is a real
   same-origin worker with a cache-first strategy for the app shell. */

const CACHE = 'safarino-v6.1.0';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // The HTML document is network-first. Cache-first left every returning
  // visitor exactly one reload behind: the old worker served the stale page
  // while the new worker installed in the background, so a shipped fix only
  // appeared on the *next* visit. Falling back to cache keeps offline working.
  const isDocument = req.mode === 'navigate' ||
                     (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  if (sameOrigin && isDocument) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Everything else same-origin: cache first, it is versioned by CACHE name.
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Webfont (the only cross-origin asset): stale-while-revalidate so the app
  // keeps its typeface offline after the first successful load.
  event.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

// deeltrack Service Worker v5 — Network-first for everything
// No more aggressive caching of JS/CSS that blocks deploys

const CACHE_NAME = 'sp-v5';

// ── Install: skip waiting immediately ─────────────────────────────────────
self.addEventListener('install', event => {
  // Purge ALL old caches on install
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: claim all clients immediately ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for everything, cache as fallback ────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).protocol === 'chrome-extension:') return;

  event.respondWith(
    fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request).then(cached =>
      cached || new Response('Offline', { status: 503 })
    ))
  );
});

// ── Message handler ───────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

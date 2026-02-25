// SyndicatePro Service Worker v3
// Network-first for HTML, Cache-first for assets, localStorage data always available

const CACHE_VERSION = 'sp-v3';
const STATIC_CACHE = 'sp-static-v3';
const DYNAMIC_CACHE = 'sp-dynamic-v3';

// Core pages to pre-cache on install
const PRECACHE = [
  '/syndicate-pro/',
  '/syndicate-pro/dashboard.html',
  '/syndicate-pro/login.html',
  '/syndicate-pro/pipeline.html',
  '/syndicate-pro/investors.html',
  '/syndicate-pro/deals.html',
  '/syndicate-pro/reports.html',
  '/syndicate-pro/deal-detail.html',
  '/syndicate-pro/distributions.html',
  '/syndicate-pro/capital-calls.html',
  '/syndicate-pro/k1-generator.html',
  '/syndicate-pro/email-templates.html',
  '/syndicate-pro/documents.html',
  '/syndicate-pro/proforma.html',
  '/syndicate-pro/settings.html',
  '/syndicate-pro/investor-portal.html',
  '/syndicate-pro/deal-room.html',
  '/syndicate-pro/deal-teaser.html',
  '/syndicate-pro/investor-statements.html',
  '/syndicate-pro/investor-detail.html',
  '/syndicate-pro/distribution-calc.html',
  '/syndicate-pro/js/sp-core.js',
  '/syndicate-pro/js/sp-notifications.js',
  '/syndicate-pro/js/storage.js',
  '/syndicate-pro/mobile.css',
  '/syndicate-pro/mobile.js',
  '/syndicate-pro/manifest.json',
];

// External CDN resources to cache
const CDN_CACHE = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// ── Install: pre-cache all core pages ────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE).catch(err => console.warn('Pre-cache partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, and analytics
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // CDN resources: Cache-first, update in background
  if (CDN_CACHE.some(cdnUrl => request.url.startsWith(cdnUrl.split('/').slice(0,3).join('/')))) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Local HTML pages: Network-first with cache fallback (always fresh when online)
  if (request.destination === 'document' || request.url.endsWith('.html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // JS/CSS/fonts: Cache-first
  if (['script','style','font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else: Network with dynamic cache fallback
  event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
});

// ── Cache strategies ──────────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline shell for any page
    return caches.match('/syndicate-pro/dashboard.html') ||
           new Response(offlinePage(), { headers: { 'Content-Type': 'text/html' } });
  }
}

function offlinePage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline — SyndicatePro</title>
  <style>body{font-family:'Inter',sans-serif;background:#0f172a;color:white;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;}
  h1{font-size:1.5rem;}p{color:#94a3b8;}</style></head>
  <body><div>◆</div><h1>You're offline</h1><p>Your data is still available. Reconnect to sync.</p>
  <a href="/syndicate-pro/dashboard.html" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Try Dashboard</a></body></html>`;
}

// ── Background sync: notify clients when back online ─────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CACHE_URLS') {
    // Allow pages to request specific URLs be cached
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(cache =>
        cache.addAll(event.data.urls || [])
      )
    );
  }
});

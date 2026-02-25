// SyndicatePro Service Worker - Offline Support
const CACHE_NAME = 'syndicatepro-v1';
const STATIC_ASSETS = [
  '/syndicate-pro/mobile-dashboard.html',
  '/syndicate-pro/m-deals.html',
  '/syndicate-pro/mobile.css',
  '/syndicate-pro/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.log('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and fetch update
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        });
        return cachedResponse;
      }
      
      // Fetch from network
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Return offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('/syndicate-pro/mobile-dashboard.html');
        }
      });
    })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-deals') {
    event.waitUntil(syncDeals());
  } else if (event.tag === 'sync-investors') {
    event.waitUntil(syncInvestors());
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data.text(),
    icon: '/syndicate-pro/icon-192x192.png',
    badge: '/syndicate-pro/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: event.data.url
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('SyndicatePro', options)
  );
});
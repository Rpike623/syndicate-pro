// deeltrack Service Worker — PASSTHROUGH ONLY
// No caching. Always fetch from network.
// This SW exists only to unregister itself and clear old caches.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.matchAll({ includeUncontrolled: true }))
      .then(clients => clients.forEach(client => client.navigate(client.url)))
      .then(() => self.registration.unregister())
  );
});

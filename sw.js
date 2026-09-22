/* ============================================
   FontX — Service Worker (Offline & PWA Support)
   ============================================ */

const CACHE_NAME = 'fontx-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/opentype.min.js',
  './assets/js/font-validator.js',
  './assets/js/kerning-editor.js',
  './assets/js/glyph-editor.js',
  './assets/js/font-factory.js',
  './assets/js/app.js',
  './assets/image/font-logo.png',
  './assets/image/font-logo.ico'
];

// Install Event: pre-cache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: clean up older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache First, falling back to Network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache external font resources or dynamic assets if valid
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// PracticeLoop Service Worker
// Network-first for HTML, cache-first for CSS/JS/images
// Shows friendly offline message when YouTube can't load

const CACHE_NAME = 'practiceloop-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/confetti.js',
  '/icon-192.png',
  '/icon-512.png',
  '/site.webmanifest'
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // HTML requests: network-first
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a copy of successful responses
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Try cache, then show offline page
          return caches.match(request).then((cached) => {
            return cached || offlinePage();
          });
        })
    );
    return;
  }

  // CSS, JS, images: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version, update in background
        fetch(request).then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
        }).catch(() => {});
        return cached;
      }
      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

// Generate a friendly offline page
function offlinePage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PracticeLoop - Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    .offline-container { max-width: 400px; }
    .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { opacity: 0.9; margin-bottom: 1.5rem; line-height: 1.5; }
    button {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 2px solid rgba(255,255,255,0.4);
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="offline-container">
    <div class="offline-icon">&#127925;</div>
    <h1>You're Offline</h1>
    <p>PracticeLoop needs an internet connection to load YouTube videos. Check your connection and try again.</p>
    <button onclick="location.reload()">Try Again</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}

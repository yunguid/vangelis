const CACHE_VERSION = 'vangelis-audio-cache-v1';
const SCOPE_URL = self.registration?.scope || '/';
const BASE_URL = new URL(SCOPE_URL);
const withBase = (path) => new URL(path, BASE_URL).toString();
const PRECACHE_URLS = [
  withBase('pkg/sound_engine.js'),
  withBase('pkg/sound_engine_bg.wasm')
];
const PKG_PREFIX = withBase('pkg/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (PRECACHE_URLS.includes(url.href)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.href.startsWith(PKG_PREFIX)) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

// Incrementa la versione a ogni rilascio per aggiornare la cache.
const CACHE = 'mensa-helper-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './calc.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: l'app funziona interamente offline (font Google inclusi dopo il primo caricamento).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(
      (cached) => cached || fetch(event.request).then((res) => {
        const url = new URL(event.request.url);
        const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
        if ((res.ok && url.origin === self.location.origin) || (font && (res.ok || res.type === 'opaque'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
    )
  );
});

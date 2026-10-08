// Incrementa la versione a ogni rilascio per aggiornare la cache.
const CACHE = 'mensa-helper-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './calc.js',
  './store.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// SDK Firebase (stessa versione importata in store.js).
const FIREBASE_SDK = ['app', 'auth', 'firestore']
  .map((m) => `https://www.gstatic.com/firebasejs/12.19.0/firebase-${m}.js`);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS, ...FIREBASE_SDK])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first per gli asset dell'app, i font e l'SDK Firebase: l'app funziona offline.
// Le chiamate a Firestore e al login non passano dalla cache.
function daCache(url) {
  if (url.origin === self.location.origin) return !url.pathname.startsWith('/__/');
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return true;
  return url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!daCache(url)) return;
  const stessaOrigine = url.origin === self.location.origin;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: stessaOrigine }).then(
      (cached) => cached || fetch(event.request).then((res) => {
        if (res.ok || (!stessaOrigine && res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
    )
  );
});

// Incrementa la versione a ogni rilascio per aggiornare la cache.
const CACHE = 'mensa-helper-v10';
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

// File dell'app: prima la rete (versione sempre coerente), la cache se offline o lenta.
// Font e SDK Firebase (URL con versione): prima la cache.
// Le chiamate a Firestore e al login non passano dal service worker.
const ATTESA_RETE_MS = 4000;

function daGestire(url) {
  if (url.origin === self.location.origin) return !url.pathname.startsWith('/__/');
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') return true;
  return url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
}

async function primaRete(request) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ATTESA_RETE_MS)),
    ]);
    if (res.ok) await c.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await c.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

async function primaCache(request) {
  const c = await caches.open(CACHE);
  const cached = await c.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') await c.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!daGestire(url)) return;
  event.respondWith(url.origin === self.location.origin ? primaRete(event.request) : primaCache(event.request));
});

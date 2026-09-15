const CACHE_NAME = 'halvmaraton-v2';
const ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Ikke rør selve sidenavigasjonen (index.html / OAuth-redirecten fra Strava) —
  // Safari takler ikke en service worker som svarer på en navigasjon som har
  // vært innom en redirect. La nettleseren håndtere de direkte.
  if (event.request.mode === 'navigate') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // ikke cache eksterne API-kall (f.eks. vær)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});


// Service worker: serves the game from Cache Storage so it plays offline from the home screen.
// The cache itself is filled by the loading screen (src/offline.ts), which shows progress.
const CACHE = 'nano-game';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      // drop caches from older versions of this worker
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('nano-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Network with a time limit: a weak connection must not keep the game from starting. */
function network(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (r) => { clearTimeout(t); r.ok ? resolve(r) : reject(new Error(String(r.status))); },
      (err) => { clearTimeout(t); reject(err); },
    );
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // the page and the file list: network first (to pick up updates), cache when offline
  if (req.mode === 'navigate') {
    e.respondWith(network(req, 4000).catch(() => caches.match('./').then((r) => r || fetch(req))));
    return;
  }
  // the loading screen asks for fresh copies explicitly
  if (req.cache === 'reload' || req.cache === 'no-store' || url.pathname.endsWith('/precache.json')) return;

  // everything else: cache first
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});

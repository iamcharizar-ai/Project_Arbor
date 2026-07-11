// Minimal service worker: makes ARBOR installable as a PWA (which lets
// Chrome persist the vault-folder permission) and caches the app shell so
// the cached tree still opens offline. Network-first for everything.
const CACHE = 'arbor-shell-v2'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })
        .then((m) => m || caches.match('/'))),
  )
})

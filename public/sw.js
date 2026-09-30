// Offline app shell.
//  • hashed build assets (/assets/*) never change → cache-first, instant loads
//  • the page itself → network-first with a short timeout, cached fallback
// Bump CACHE when this file's strategy changes; old caches are dropped on activate.
const CACHE = 'arbor-shell-v5'
const PAGE_TIMEOUT_MS = 2500

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

const store = (req, res) => {
  if (res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))))
    return
  }

  e.respondWith(
    Promise.race([
      fetch(req).then((res) => store(req, res)),
      new Promise((_, reject) => setTimeout(reject, PAGE_TIMEOUT_MS)),
    ]).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('/'))),
  )
})

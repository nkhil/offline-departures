const CACHE = 'offline-v5'
const PRECACHE = ['/', '/data.json', '/manifest.webmanifest', '/192.png', '/512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/data.json') {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || new Response('{"error":"cache-miss"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
    )
    return
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})

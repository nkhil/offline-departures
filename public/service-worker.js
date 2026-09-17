const CACHE = 'offline-v4'
const PRECACHE = ['/', '/data.json', '/manifest.webmanifest', '/192.png', '/512.png']

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'WARM_CACHE' || !Array.isArray(event.data.urls)) return

  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const sameOriginUrls = event.data.urls
        .filter((url) => typeof url === 'string')
        .map((url) => {
          try {
            return new URL(url, self.location.origin)
          } catch {
            return null
          }
        })
        .filter((url) => url && url.origin === self.location.origin)

      await Promise.all(
        sameOriginUrls.map(async (url) => {
          const request = new Request(url.href, { credentials: 'same-origin' })
          try {
            const response = await fetch(request)
            if (response.ok) await cache.put(request, response.clone())
          } catch {
            // Ignore warm-cache fetch failures
          }
        })
      )
    })
  )
})

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

  const isDocument = event.request.mode === 'navigate'
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    ['script', 'style', 'image', 'font'].includes(event.request.destination)

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request)
          if (cachedPage) return cachedPage
          return caches.match('/')
        })
    )
    return
  }

  if (isStaticAsset || url.pathname === '/data.json') {
    if (url.pathname === '/data.json') {
      event.respondWith(
        caches
          .match(event.request)
          .then((cached) => cached || new Response('{"error":"cache-miss"}', { status: 503, headers: { 'Content-Type': 'application/json' } }))
      )
      return
    }

    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
            return response
          })
          .catch(() => cached)

        return cached || networkFetch
      })
    )
    return
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
})

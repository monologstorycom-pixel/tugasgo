const CACHE = 'tugasgo-v2'
const PRECACHE = ['/', '/manifest.json', '/image/icon-192.png', '/image/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Jangan intercept API calls dan WebSocket
  if (url.pathname.startsWith('/api') || url.protocol === 'ws:' || url.protocol === 'wss:') return

  // Network first untuk navigasi halaman (HTML)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => caches.match(request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // Cache first untuk assets statis
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET' && (url.origin === self.location.origin)) {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => cached)
    })
  )
})

// Push notification handler
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  self.registration.showNotification(data.title || 'TugasGo', {
    body: data.message || '',
    icon: '/image/icon-192.png',
    badge: '/image/icon-192.png',
    tag: data.taskId ? `task-${data.taskId}` : 'tugasgo',
    data: { url: data.url || '/' }
  })
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.openWindow(e.notification.data?.url || '/')
  )
})

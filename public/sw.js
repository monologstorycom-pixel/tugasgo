const CACHE = 'tugasgo-v1'
const STATIC = ['/', '/src/main.tsx']

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Jangan cache API calls dan WebSocket
  if (url.pathname.startsWith('/api') || url.protocol === 'ws:' || url.protocol === 'wss:') return

  // Network first untuk navigasi
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  // Cache first untuk assets statis
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(() => cached)
    })
  )
})

// Push notification handler (untuk future)
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  self.registration.showNotification(data.title || 'TugasGo', {
    body: data.message || '',
    icon: '/image/logo1.png',
    badge: '/image/logo1.png',
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

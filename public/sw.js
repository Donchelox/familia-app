self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title || 'Recordatorio de Medicamento'
  const options = {
    body: data.body || 'Es hora de tu dosis programada.',
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/medicamentos',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/medicamentos') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url)
      }
    })
  )
})
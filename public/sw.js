self.addEventListener('push', function (event) {
  let title = '💊 Recordatorio de Medicamento'
  let body = 'Es hora de tu dosis programada.'
  let url = '/medicamentos'

  if (event.data) {
    try {
      const data = event.data.json()
      if (data.title) title = data.title
      if (data.body) body = data.body
      if (data.url) url = data.url
    } catch (e) {
      // Si vino en formato texto
      body = event.data.text()
    }
  }

  const options = {
    body: body,
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
    vibrate: [200, 100, 200],
    tag: 'medication-reminder',
    renotify: true,
    data: { url: url },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/medicamentos'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
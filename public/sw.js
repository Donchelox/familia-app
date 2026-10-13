// --- Historial de notificaciones (IndexedDB, compartido con la app: ver lib/pushHistory.ts) ---
const DB_NAME = 'casa-push'
const STORE = 'notifications'
const MAX_ITEMS = 100

function openDb() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = function () {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('received_at', 'received_at')
      }
    }
    req.onsuccess = function () { resolve(req.result) }
    req.onerror = function () { reject(req.error) }
  })
}

async function saveNotification(item) {
  const db = await openDb()
  try {
    await new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      store.put(item)
      // Conserva solo las últimas MAX_ITEMS (las claves salen ordenadas de la más antigua a la más nueva)
      const keysReq = store.index('received_at').getAllKeys()
      keysReq.onsuccess = function () {
        const extra = keysReq.result.length - MAX_ITEMS
        for (let i = 0; i < extra; i++) store.delete(keysReq.result[i])
      }
      tx.oncomplete = function () { resolve() }
      tx.onerror = function () { reject(tx.error) }
    })
  } finally {
    db.close()
  }
}

function notifyClients() {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (list) {
      list.forEach(function (c) { c.postMessage({ type: 'push-history-updated' }) })
    })
}

// Toma el control de inmediato cuando hay una versión nueva del service worker
self.addEventListener('install', function () { self.skipWaiting() })
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()) })

self.addEventListener('push', function (event) {
  let title = '💊 Recordatorio de Medicamento'
  let body = 'Es hora de tu dosis programada.'
  let url = '/meds'
  let tag = ''

  if (event.data) {
    try {
      const data = event.data.json()
      if (data.title) title = data.title
      if (data.body) body = data.body
      if (data.url) url = data.url
      if (data.tag) tag = data.tag
    } catch (e) {
      // Si vino en formato texto
      body = event.data.text()
    }
  }

  const id =
    self.crypto && self.crypto.randomUUID
      ? self.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2)

  const show = self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
    vibrate: [200, 100, 200],
    // Un tag distinto por aviso: si no, dos remedios a la misma hora se pisan en la bandeja
    tag: tag || 'casa-' + id,
    renotify: true,
    data: { url: url, id: id },
  })

  const save = saveNotification({
    id: id,
    title: title,
    body: body,
    url: url,
    tag: tag,
    received_at: new Date().toISOString(),
    read: false,
  })
    .then(notifyClients)
    .catch(function (err) { console.error('No se pudo guardar la notificación:', err) })

  event.waitUntil(Promise.all([show, save]))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/meds'

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

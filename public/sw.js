/**
 * Service Worker para Casa App
 * Soporte Offline-First (PWA), Caching de App Shell, Background Sync y Notificaciones Web Push
 */

const CACHE_VERSION = 'casa-pwa-v2.1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`

// Rutas esenciales que componen el App Shell completo de Casa App
const APP_SHELL_URLS = [
  '/',
  '/resumen',
  '/meds',
  '/colegio',
  '/super',
  '/feria',
  '/tareas',
  '/ajustes',
  '/manifest.webmanifest',
  '/icon-192.webp',
  '/icon-512.webp',
  '/splash-art.webp',
]

// --- 1. INSTALACIÓN Y PRECACHE DEL APP SHELL ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      // Precachear todas las páginas principales de forma resiliente
      return Promise.allSettled(
        APP_SHELL_URLS.map(async (url) => {
          try {
            const res = await fetch(url)
            if (res.ok) {
              await cache.put(url, res)
            }
          } catch (err) {
            console.warn(`[SW] Precache ignorado para ${url} (offline o no disponible):`, err)
          }
        })
      )
    })
  )
  self.skipWaiting()
})

// --- 2. ACTIVACIÓN Y LIMPIEZA DE CACHES ANTIGUAS ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            console.log(`[SW] Purgando caché obsoleta: ${key}`)
            return caches.delete(key)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// --- 3. INTERCEPCIÓN DE RED Y ESTRATEGIAS DE CACHÉ ---
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar orígenes externos (ej. Supabase API directa, analytics o extensiones)
  if (url.origin !== self.location.origin) {
    return
  }

  // Ignorar APIs del backend (/api/*) y métodos no GET (POST/PUT/DELETE)
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return
  }

  const isNavigation = request.mode === 'navigate'
  const isRSC =
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    Boolean(request.headers.get('Accept')?.includes('text/x-component'))

  // ESTRATEGIA A: Rutas de Navegación HTML Y Peticiones RSC de Next.js
  if (isNavigation || isRSC) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => {
              // Cachear la petición exacta
              cache.put(request, responseClone)
              // SOLO almacenar url.pathname si es navegación HTML real (NUNCA si es payload RSC)
              if (isNavigation) {
                cache.put(url.pathname, response.clone())
              }
            })
          }
          return response
        })
        .catch(async () => {
          // Si estamos offline o la red falla, resolver desde Caché local:
          // 1. Coincidencia exacta de la petición (incluyendo querystring de RSC)
          const exactMatch = await caches.match(request)
          if (exactMatch) return exactMatch

          // 2. Coincidencia por pathname limpio si es navegación
          if (isNavigation) {
            const pathMatch = await caches.match(url.pathname)
            if (pathMatch) return pathMatch

            const rootShell = await caches.match('/')
            if (rootShell) return rootShell
          }

          // 3. Fallback genérico si no hay nada guardado aún
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Casa - Offline</title></head><body style="background:#131313;color:#fff;font-family:sans-serif;padding:24px;text-align:center;"><h2>Modo sin conexión</h2><p>Página en espera de sincronización local.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        })
    )
    return
  }

  // ESTRATEGIA B: Archivos estáticos de Next.js (_next/static/) y Estilos CSS
  // Network-First con fallback a caché para garantizar que nunca se cargue CSS desactualizado o roto
  if (url.pathname.startsWith('/_next/static/') || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached

          // Si es CSS y no está la clave exacta, buscar cualquier CSS disponible en caché estática
          if (request.destination === 'style' || url.pathname.endsWith('.css')) {
            const staticCache = await caches.open(STATIC_CACHE)
            const keys = await staticCache.keys()
            const cssKey = keys.find((k) => k.url.includes('.css'))
            if (cssKey) {
              const fallbackCss = await staticCache.match(cssKey)
              if (fallbackCss) return fallbackCss
            }
          }

          return new Response('', { headers: { 'Content-Type': 'text/css' } })
        })
    )
    return
  }

  // ESTRATEGIA C: Imágenes estáticas, fuentes e iconos
  // Stale-While-Revalidate seguro sin devolver null
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse || new Response(''))

        return cachedResponse || fetchPromise
      })
    )
    return
  }
})

// --- 4. BACKGROUND SYNC API ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'casa-sync-queue' || event.tag === 'sync-family-data') {
    event.waitUntil(notifyClientsToSync())
  }
})

function notifyClientsToSync() {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' })
    })
  })
}

// --- 5. HISTORIAL DE NOTIFICACIONES PUSH EN INDEXEDDB ---
const PUSH_DB_NAME = 'casa-push'
const PUSH_STORE = 'notifications'
const MAX_PUSH_ITEMS = 100

function openPushDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(PUSH_STORE)) {
        const store = db.createObjectStore(PUSH_STORE, { keyPath: 'id' })
        store.createIndex('received_at', 'received_at')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveNotification(item) {
  const db = await openPushDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PUSH_STORE, 'readwrite')
      const store = tx.objectStore(PUSH_STORE)
      store.put(item)
      const keysReq = store.index('received_at').getAllKeys()
      keysReq.onsuccess = () => {
        const extra = keysReq.result.length - MAX_PUSH_ITEMS
        for (let i = 0; i < extra; i++) store.delete(keysReq.result[i])
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

function notifyPushClients() {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => {
      list.forEach((c) => c.postMessage({ type: 'push-history-updated' }))
    })
}

// --- 6. EVENTOS DE PUSH Y CLICK DE NOTIFICACIÓN ---
self.addEventListener('push', (event) => {
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
    } catch {
      body = event.data.text()
    }
  }

  const id =
    self.crypto && self.crypto.randomUUID
      ? self.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2)

  const show = self.registration.showNotification(title, {
    body,
    icon: '/icon-192.webp',
    badge: '/icon-192.webp',
    vibrate: [200, 100, 200],
    tag: tag || 'casa-' + id,
    renotify: true,
    data: { url, id },
  })

  const save = saveNotification({
    id,
    title,
    body,
    url,
    tag,
    received_at: new Date().toISOString(),
    read: false,
  })
    .then(notifyPushClients)
    .catch((err) => console.error('No se pudo guardar la notificación:', err))

  event.waitUntil(Promise.all([show, save]))
})

self.addEventListener('notificationclick', (event) => {
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

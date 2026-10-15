/**
 * Service Worker para Casa App
 * Soporte Offline-First (PWA), Caching de App Shell, RSC Flight Streams, Background Sync y Push
 */

const CACHE_VERSION = 'casa-pwa-v4.0'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`

// Rutas esenciales del App Shell completo de Casa App
const APP_SHELL_URLS = [
  '/',
  '/tareas',
  '/feria',
  '/super',
  '/colegio',
  '/meds',
  '/resumen',
  '/ajustes',
  '/manifest.webmanifest',
  '/icon-192.webp',
  '/icon-512.webp',
  '/splash-art.webp',
]

// --- 1. INSTALACIÓN Y PRECACHE COMPLETO (HTML, RSC Y CSS REALES) ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shellCache = await caches.open(APP_SHELL_CACHE)
      const staticCache = await caches.open(STATIC_CACHE)

      for (const url of APP_SHELL_URLS) {
        try {
          // A) Precache de la página HTML
          const res = await fetch(url, { cache: 'no-cache' })
          if (res.ok && res.status === 200) {
            await shellCache.put(url, res.clone())
            await shellCache.put(new URL(url, self.location.origin).href, res.clone())

            // Extraer y precachear CSS reales vinculados en el HTML
            const html = await res.text()
            const cssMatches = html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)
            for (const match of cssMatches) {
              const cssUrl = match[1]
              try {
                const cssRes = await fetch(cssUrl)
                if (cssRes.ok) {
                  await staticCache.put(cssUrl, cssRes.clone())
                  await staticCache.put('/_next/static/css/global-fallback.css', cssRes.clone())
                }
              } catch {}
            }

            // Extraer y precachear scripts JS de la página
            const jsMatches = html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)
            for (const match of jsMatches) {
              const jsUrl = match[1]
              try {
                const jsRes = await fetch(jsUrl)
                if (jsRes.ok) {
                  await staticCache.put(jsUrl, jsRes.clone())
                }
              } catch {}
            }
          }

          // B) Precache del payload RSC (React Server Components) para navegación client-side offline
          if (url.startsWith('/') && !url.includes('.')) {
            try {
              const rscRes = await fetch(url, {
                headers: { RSC: '1', Accept: 'text/x-component' },
                cache: 'no-cache',
              })
              if (rscRes.ok && rscRes.status === 200) {
                await shellCache.put(`${url}__rsc`, rscRes.clone())
                await shellCache.put(`${url}?_rsc=offline`, rscRes.clone())
                await shellCache.put(new URL(`${url}?_rsc=offline`, self.location.origin).href, rscRes.clone())
              }
            } catch {}
          }
        } catch (err) {
          console.warn(`[SW] Precache omitido temporalmente para ${url}:`, err)
        }
      }
    })()
  )
  self.skipWaiting()
})

// --- 2. ACTIVACIÓN Y LIMPIEZA DE CACHES OBSOLETAS ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (!key.startsWith(CACHE_VERSION)) {
              console.log(`[SW] Limpiando caché anterior: ${key}`)
              return caches.delete(key)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// --- 3. INTERCEPCIÓN DE RED CON SOPORTE RSC Y RESILIENCIA TOTAL ---
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar orígenes externos (ej. Supabase API remota, extensiones)
  if (url.origin !== self.location.origin) {
    return
  }

  // Ignorar endpoints de API, métodos no GET y herramientas de dev HMR
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.startsWith('/__nextjs')
  ) {
    return
  }

  const isNavigation = request.mode === 'navigate'
  const isRSC =
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    Boolean(request.headers.get('Accept')?.includes('text/x-component'))

  // ESTRATEGIA A-1: PETICIONES RSC DE NEXT.JS (NAVEGACIÓN INTERNA CLIENT-SIDE ENTRE PÁGINAS)
  if (isRSC) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => {
              cache.put(request, clone)
              // Almacenar también bajo clave canónica limpia por pathname para absorber cualquier querystring
              cache.put(`${url.pathname}__rsc`, response.clone())
            })
          }
          return response
        })
        .catch(async () => {
          // Si estamos offline: buscar el payload RSC correspondiente
          // 1. Coincidencia exacta de la petición
          const exact = await caches.match(request)
          if (exact) return exact

          // 2. Coincidencia canónica para este pathname
          const canonical = await caches.match(`${url.pathname}__rsc`)
          if (canonical) return canonical

          // 3. Buscar cualquier clave RSC almacenada para este pathname
          const shellCache = await caches.open(APP_SHELL_CACHE)
          const keys = await shellCache.keys()
          const rscKey = keys.find((k) => {
            const u = new URL(k.url)
            return (
              u.pathname === url.pathname &&
              (u.searchParams.has('_rsc') || u.pathname.endsWith('__rsc'))
            )
          })
          if (rscKey) {
            const cachedRsc = await shellCache.match(rscKey)
            if (cachedRsc) return cachedRsc
          }

          // IMPORTANTE: NUNCA responder HTML a una petición RSC porque rompe el router de React.
          // Responder 503 permite a Next.js intentar una navegación completa de documento.
          return new Response('RSC offline no disponible en caché', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        })
    )
    return
  }

  // ESTRATEGIA A-2: NAVEGACIÓN COMPLETA DE DOCUMENTO HTML (RECARGA O URL DIRECTA)
  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => {
              cache.put(request, clone)
              cache.put(url.pathname, response.clone())
              cache.put(new URL(url.pathname, self.location.origin).href, response.clone())
            })
          }
          return response
        })
        .catch(async () => {
          // 1. Coincidencia exacta de la petición
          const exact = await caches.match(request)
          if (exact) return exact

          // 2. Coincidencia por pathname específico (ej: '/tareas' o '/feria')
          const pathMatch = await caches.match(url.pathname)
          if (pathMatch) return pathMatch

          const fullUrlMatch = await caches.match(new URL(url.pathname, self.location.origin).href)
          if (fullUrlMatch) return fullUrlMatch

          // 3. Si la ruta es específicamente Home ('/'), entregar el shell de inicio
          if (url.pathname === '/') {
            const homeMatch = await caches.match('/')
            if (homeMatch) return homeMatch
          }

          // AVISO CRÍTICO: NO entregar caches.match('/') para rutas distintas a '/' (evita que /tareas o /feria queden pegadas en Home)
          // 4. Si la ruta solicitada no estaba en caché aún, mostrar pantalla offline amigable
          return new Response(
            `<!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Casa - Sin conexión</title>
              <style>
                body { background: #131313; color: #fff; font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
                h2 { font-size: 20px; font-weight: 800; margin-bottom: 8px; color: #F76911; }
                p { color: #a3a3a3; font-size: 14px; max-width: 320px; line-height: 1.5; margin-bottom: 24px; }
                a { display: inline-block; padding: 12px 24px; background: #F76911; color: #fff; font-weight: bold; font-size: 14px; border-radius: 16px; text-decoration: none; }
              </style>
            </head>
            <body>
              <h2>Modo sin conexión</h2>
              <p>La sección ${url.pathname} requiere conexión inicial para guardarse offline.</p>
              <a href="/">Volver al Inicio</a>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        })
    )
    return
  }

  // ESTRATEGIA B: ESTILOS CSS (GARANTÍA ABSOLUTA DE NO PERDER CSS NI EN DEV NI EN OFFLINE)
  if (request.destination === 'style' || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            const cache = await caches.open(STATIC_CACHE)
            await cache.put(request, clone)
            await cache.put('/_next/static/css/global-fallback.css', response.clone())
            return response
          }

          // Si el servidor devolvió 404 (el hash del CSS cambió con un nuevo build), buscar en caché
          const exactCss = await caches.match(request)
          if (exactCss) return exactCss

          const fallbackCss = await caches.match('/_next/static/css/global-fallback.css')
          if (fallbackCss) return fallbackCss

          const staticCache = await caches.open(STATIC_CACHE)
          const keys = await staticCache.keys()
          const cssKey = keys.find((k) => k.url.includes('.css'))
          if (cssKey) {
            const anyCss = await staticCache.match(cssKey)
            if (anyCss) return anyCss
          }

          return response
        })
        .catch(async () => {
          // En modo offline: recuperar CSS de la caché
          const cached = await caches.match(request)
          if (cached) return cached

          const fallbackCss = await caches.match('/_next/static/css/global-fallback.css')
          if (fallbackCss) return fallbackCss

          const staticCache = await caches.open(STATIC_CACHE)
          const keys = await staticCache.keys()
          const cssKey = keys.find((k) => k.url.includes('.css'))
          if (cssKey) {
            const anyCss = await staticCache.match(cssKey)
            if (anyCss) return anyCss
          }

          return new Response('/* Offline fallback */', { headers: { 'Content-Type': 'text/css' } })
        })
    )
    return
  }

  // ESTRATEGIA C: JAVASCRIPT CHUNKS (_next/static/chunks/)
  if (url.pathname.startsWith('/_next/static/chunks/') || request.destination === 'script') {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      })
    )
    return
  }

  // ESTRATEGIA D: IMÁGENES ESTÁTICAS, FUENTES Y MANIFEST (Stale-While-Revalidate)
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

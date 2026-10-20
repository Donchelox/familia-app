'use client'

import { syncManager } from './syncManager'
import { saveOfflineFamilyId } from './familyContext'
import { offlineDB } from './db'

export const CACHE_VERSION = 'casa-pwa-v5.0'
export const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`
export const STATIC_CACHE = `${CACHE_VERSION}-static`

export const CORE_ROUTES = [
  '/',
  '/tareas',
  '/feria',
  '/super',
  '/colegio',
  '/meds',
  '/resumen',
  '/ajustes',
]

/**
 * Pre-calienta y almacena tanto el HTML completo como el payload RSC de todas las rutas clave.
 * Esto asegura que cuando el usuario esté sin internet pueda navegar y recargar CUALQUIER sección.
 */
export async function preheatAppShell(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return
  if (!navigator.onLine) return

  try {
    const shellCache = await caches.open(APP_SHELL_CACHE)
    const staticCache = await caches.open(STATIC_CACHE)

    for (const route of CORE_ROUTES) {
      try {
        // 1. Precache HTML completo de la página
        const htmlRes = await fetch(route, {
          credentials: 'include',
          cache: 'no-cache',
        })

        if (
          htmlRes.ok &&
          htmlRes.status === 200 &&
          !htmlRes.redirected &&
          !htmlRes.url.includes('/login')
        ) {
          await shellCache.put(route, htmlRes.clone())
          await shellCache.put(new URL(route, window.location.origin).href, htmlRes.clone())

          // Extraer y precachear scripts JS y estilos CSS vinculados en el HTML
          const htmlText = await htmlRes.text()
          const scriptMatches = Array.from(htmlText.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g))
          for (const match of scriptMatches) {
            const jsUrl = match[1]
            try {
              const jsRes = await fetch(jsUrl)
              if (jsRes.ok) {
                await staticCache.put(jsUrl, jsRes.clone())
              }
            } catch {}
          }

          const cssMatches = Array.from(htmlText.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g))
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
        }

        // 2. Precache del payload RSC de Next.js (necesario para transiciones suaves de Link offline)
        const rscRes = await fetch(route, {
          headers: { RSC: '1', Accept: 'text/x-component' },
          credentials: 'include',
          cache: 'no-cache',
        })

        if (
          rscRes.ok &&
          rscRes.status === 200 &&
          !rscRes.redirected &&
          !rscRes.url.includes('/login')
        ) {
          await shellCache.put(`${route}__rsc`, rscRes.clone())
          await shellCache.put(`${route}?_rsc=offline`, rscRes.clone())
          await shellCache.put(new URL(`${route}?_rsc=offline`, window.location.origin).href, rscRes.clone())
        }
      } catch (routeErr) {
        console.debug(`[ClientSync] Error precacheando ruta ${route}:`, routeErr)
      }
    }

    // Notificar al Service Worker para registrar rutas adicionales si las hay
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRECACHE_CORE_ROUTES',
        routes: CORE_ROUTES,
      })
    }
  } catch (err) {
    console.debug('[ClientSync] Error general en preheatAppShell:', err)
  }
}

/**
 * Purga total de toda la memoria local, base de datos IndexedDB y cachés del navegador.
 * Garantiza que al cerrar sesión no quede ningún dato de la familia anterior.
 */
export async function purgeAllUserDataAndCache(): Promise<void> {
  // 1. Limpiar Dexie completamente
  try {
    await offlineDB.clearAllTables()
  } catch (err) {
    console.debug('[PurgeCache] Error limpiando Dexie:', err)
  }

  // 2. Limpiar LocalStorage y SessionStorage
  try {
    if (typeof window !== 'undefined') {
      localStorage.clear()
      sessionStorage.clear()
    }
  } catch (err) {
    console.debug('[PurgeCache] Error limpiando Storage:', err)
  }

  // 3. Limpiar CacheStorage (Service Worker caches) directamente desde window.caches
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
    }
  } catch (err) {
    console.debug('[PurgeCache] Error limpiando CacheStorage:', err)
  }

  // 4. Notificar a Service Worker si está activo para que vacíe cachés en memoria
  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'PURGE_CACHE' })
    }
  } catch {}
}

/**
 * Limpia de verdad toda la caché de la aplicación web (CacheStorage, Service Worker, Dexie y storage temporal)
 * manteniendo la sesión activa del usuario, y fuerza la recarga limpia.
 */
export async function clearWebappCache(): Promise<void> {
  // 1. Borrar todas las entradas en CacheStorage (Service Worker caches)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch (err) {
    console.warn('[ClearCache] Error borrando window.caches:', err)
  }

  // 2. Notificar al Service Worker para borrar cachés internas y buscar actualización
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'PURGE_ALL_CACHES' })
      }
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        try {
          await reg.update()
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[ClearCache] Error actualizando Service Worker:', err)
  }

  // 3. Limpiar base de datos local Dexie para forzar re-hidratación limpia desde Supabase
  try {
    await offlineDB.clearAllTables()
  } catch (err) {
    console.warn('[ClearCache] Error vaciando Dexie:', err)
  }

  // 4. Limpiar SessionStorage y cachés volátiles de localStorage (preservando credenciales de auth)
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.clear()
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !key.startsWith('sb-') && !key.includes('auth')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    }
  } catch (err) {
    console.warn('[ClearCache] Error limpiando storages locales:', err)
  }

  // 5. Recarga forzada de la página con cache-busting
  if (typeof window !== 'undefined') {
    const cleanUrl = window.location.pathname
    window.location.replace(`${cleanUrl}?cache_clean=${Date.now()}`)
  }
}

/**
 * Hidrata todos los datos remotos de la familia en Dexie y guarda el familyId
 */
export async function hydrateFamilyData(familyId: string): Promise<void> {
  if (!familyId || !familyId.trim()) return

  if (typeof window !== 'undefined') {
    const prevFam = localStorage.getItem('casa_family_id')
    if (prevFam && prevFam !== familyId.trim()) {
      try {
        await purgeAllUserDataAndCache()
      } catch (err) {
        console.debug('[ClientSync] Error limpiando tablas locales tras cambio de familia:', err)
      }
    }
  }

  saveOfflineFamilyId(familyId)

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await syncManager.pullRemoteData(familyId)
    } catch (e) {
      console.debug('[ClientSync] Error hidratando datos de familia:', e)
    }
  }
}

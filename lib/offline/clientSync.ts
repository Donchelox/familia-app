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
 * Hidrata todos los datos remotos de la familia en Dexie y guarda el familyId
 */
export async function hydrateFamilyData(familyId: string): Promise<void> {
  if (!familyId || !familyId.trim()) return

  if (typeof window !== 'undefined') {
    const prevFam = localStorage.getItem('casa_family_id')
    if (prevFam && prevFam !== familyId.trim()) {
      try {
        await offlineDB.clearAllTables()
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

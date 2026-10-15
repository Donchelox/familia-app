'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CORE_ROUTES = ['/', '/resumen', '/meds', '/colegio', '/super', '/feria', '/tareas', '/ajustes']

export default function PWARegister() {
  const router = useRouter()

  useEffect(() => {
    // 1. Precalentar la caché de Next.js para todas las rutas principales
    if (typeof window !== 'undefined') {
      CORE_ROUTES.forEach((r) => {
        try {
          router.prefetch(r)
        } catch {}
      })
    }

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // En desarrollo local (localhost, IPs privadas o puertos locales), desregistrar SW para no romper CSS ni HMR
    const isLocalDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local') ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      Boolean(window.location.port)

    if (isLocalDev) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister()
        }
      })
      if (typeof caches !== 'undefined') {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
      }
      return
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // Forzar actualización inmediata del Service Worker si hay nueva versión
        try {
          await registration.update()
        } catch {}

        // Comprobar actualizaciones en cada visita
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nueva versión disponible en segundo plano.')
            }
          })
        })

        // Registrar Background Sync si está disponible en el navegador
        if ('sync' in registration) {
          try {
            await (registration as any).sync.register('casa-sync-queue')
          } catch (syncErr) {
            console.debug('[PWA] Background Sync no disponible o rechazado:', syncErr)
          }
        }
      } catch (err) {
        console.error('[PWA] Error registrando el Service Worker:', err)
      }
    }

    // Escuchar cambio de controlador para refrescar con los nuevos estilos limpios
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    // Registrar cuando la página esté lista
    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      return () => window.removeEventListener('load', registerSW)
    }
  }, [router])

  return null
}

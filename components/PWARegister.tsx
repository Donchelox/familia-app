'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const CORE_ROUTES = ['/', '/meds', '/colegio', '/super', '/feria', '/tareas', '/ajustes']

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

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

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

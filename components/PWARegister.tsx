'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { preheatAppShell, hydrateFamilyData, CORE_ROUTES } from '@/lib/offline/clientSync'
import { createClient } from '@/lib/supabase/client'
import { getOfflineFamilyId } from '@/lib/offline/familyContext'

export default function PWARegister() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Router prefetch nativo de Next.js
    CORE_ROUTES.forEach((r) => {
      try {
        router.prefetch(r)
      } catch {}
    })

    // 2. Precalentar la caché completa (HTML, RSC y chunks estáticos) e hidratar Dexie si estamos online
    const initOfflineCapabilities = async () => {
      if (!navigator.onLine) return

      try {
        // 1. Detectar familyId activo para hidratar la base de datos local Dexie de inmediato
        const supabase = createClient()
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes?.user

        if (user) {
          const { data: member } = await supabase
            .from('members')
            .select('family_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle()

          if (member?.family_id) {
            hydrateFamilyData(member.family_id).catch(() => {})
          } else {
            const fallbackId = await getOfflineFamilyId()
            if (fallbackId) {
              hydrateFamilyData(fallbackId).catch(() => {})
            }
          }
        } else {
          const fallbackId = await getOfflineFamilyId()
          if (fallbackId) {
            hydrateFamilyData(fallbackId).catch(() => {})
          }
        }

        // 2. Pre-cargar HTML y RSC de todas las páginas de Casa en segundo plano sin bloquear datos
        preheatAppShell().catch(() => {})
      } catch (err) {
        console.debug('[PWA] Error inicializando capacidades offline:', err)
      }
    }

    // Ejecutar precalentamiento inicial no bloqueante
    initOfflineCapabilities()

    // Volver a precalentar e hidratar cuando vuelva la conexión
    const handleOnline = () => {
      initOfflineCapabilities()
    }
    window.addEventListener('online', handleOnline)

    // 3. Registro y control del Service Worker
    if (!('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', handleOnline)
      }
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // Forzar actualización si hay nueva versión de SW
        try {
          await registration.update()
        } catch {}

        // Comprobar actualizaciones
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nueva versión v5.0 lista en segundo plano.')
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

    // Escuchar cambio de controlador (solo recargar si ya existía un controlador previo, no en primera instalación)
    const hadController = Boolean(navigator.serviceWorker.controller)
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      return () => {
        window.removeEventListener('load', registerSW)
        window.removeEventListener('online', handleOnline)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [router])

  return null
}

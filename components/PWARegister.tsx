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
        // Pre-cargar HTML y RSC de todas las páginas de Casa
        await preheatAppShell()

        // Detectar familyId activo para hidratar la base de datos local Dexie
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
            await hydrateFamilyData(member.family_id)
          } else {
            const fallbackId = await getOfflineFamilyId()
            if (fallbackId) {
              await hydrateFamilyData(fallbackId)
            }
          }
        } else {
          const fallbackId = await getOfflineFamilyId()
          if (fallbackId) {
            await hydrateFamilyData(fallbackId)
          }
        }
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

    // Escuchar cambio de controlador y aviso de purga de caché
    let refreshing = false
    const handleReload = () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleReload)

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_PURGED_UPDATE') {
        handleReload()
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    const cleanupListeners = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleReload)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      window.removeEventListener('online', handleOnline)
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      return () => {
        window.removeEventListener('load', registerSW)
        cleanupListeners()
      }
    }

    return () => {
      cleanupListeners()
    }
  }, [router])

  return null
}

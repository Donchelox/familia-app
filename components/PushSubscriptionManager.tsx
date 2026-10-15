'use client'

import { useState, useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Guarda (o actualiza) la suscripción de este dispositivo en el servidor. Falla si el servidor la rechaza.
async function saveSubscription(sub: PushSubscription) {
  const data = JSON.parse(JSON.stringify(sub))
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: data.endpoint,
      p256dh: data.keys?.p256dh,
      auth: data.keys?.auth,
    }),
  })
  if (!res.ok) throw new Error('No se pudo registrar este dispositivo en el servidor')
}

type Status = 'loading' | 'unsupported' | 'denied' | 'off' | 'on'

const cardClass = 'p-4 rounded-[22px] bg-[#1a1a1a] border border-neutral-800/90 flex flex-col gap-3'

export default function PushSubscriptionManager() {
  const [status, setStatus] = useState<Status>('loading')
  const [isIos, setIsIos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent))
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStatus('unsupported')
        return
      }
      try {
        await navigator.serviceWorker.register('/sw.js')
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return
        if (Notification.permission === 'denied') {
          setStatus('denied')
        } else if (sub && Notification.permission === 'granted') {
          setStatus('on')
          // Reenvía la suscripción por si antes no quedó guardada en el servidor (es idempotente)
          saveSubscription(sub).catch((e) => console.error('push resync:', e))
        } else {
          setStatus('off')
        }
      } catch (e) {
        console.error('push init:', e)
        if (!cancelled) setStatus('off')
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  async function subscribe() {
    setBusy(true)
    setError('')
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) throw new Error('Falta la variable NEXT_PUBLIC_VAPID_PUBLIC_KEY en el despliegue')

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }))

      await saveSubscription(sub)
      setStatus('on')
    } catch (err) {
      console.error('Error al suscribir a notificaciones push:', err)
      setError(err instanceof Error ? err.message : 'No se pudo activar las notificaciones')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return null

  if (status === 'on') {
    return (
      <p className="text-[11px] font-semibold text-neutral-500 m-0 px-1">
        ✓ Notificaciones push activas en este dispositivo
      </p>
    )
  }

  if (status === 'unsupported') {
    return (
      <div className={cardClass}>
        <p className="text-sm font-bold text-white m-0">Notificaciones push no disponibles</p>
        <p className="text-xs text-neutral-400 leading-relaxed m-0">
          {isIos
            ? 'En iPhone debes instalar la app: toca Compartir → "Añadir a pantalla de inicio" y ábrela desde ese ícono. Luego vuelve aquí para activarlas.'
            : 'Este navegador no permite notificaciones push. Prueba con Chrome, Edge o Firefox actualizados.'}
        </p>
      </div>
    )
  }

  if (status === 'denied') {
    return (
      <div className={cardClass}>
        <p className="text-sm font-bold text-white m-0">Notificaciones bloqueadas</p>
        <p className="text-xs text-neutral-400 leading-relaxed m-0">
          Bloqueaste las notificaciones de esta app. Para recibirlas, permítelas en los ajustes del navegador o del dispositivo y recarga la página.
        </p>
      </div>
    )
  }

  return (
    <div className={cardClass}>
      <div>
        <p className="text-sm font-bold text-white m-0">Activa las notificaciones</p>
        <p className="text-xs text-neutral-400 leading-relaxed mt-1 m-0">
          Recibe en este dispositivo los avisos de la app, como los recordatorios de medicamentos.
        </p>
      </div>
      {error && <p className="text-xs font-semibold text-red-400 m-0">{error}</p>}
      <button
        type="button"
        onClick={subscribe}
        disabled={busy}
        style={{ background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)' }}
        className="w-fit px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
      >
        {busy ? 'Activando...' : '🔔 Activar notificaciones'}
      </button>
    </div>
  )
}

/** Cancela la suscripción en el navegador y en el servidor vía DELETE /api/push/subscribe */
export async function unsubscribeCurrentPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch((e) => console.warn('Push delete request error:', e))
      await sub.unsubscribe().catch((e) => console.warn('Push unsubscribe error:', e))
    }
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_USER_CACHE' })
    }
  } catch (e) {
    console.warn('Error en unsubscribeCurrentPush:', e)
  }
}


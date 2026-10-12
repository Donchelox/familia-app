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

export default function PushSubscriptionManager({ familyId }: { familyId: string }) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      navigator.serviceWorker.register('/sw.js')
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setIsSubscribed(true)
        })
      })
    }
  }, [])

  async function subscribe() {
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      const subData = JSON.parse(JSON.stringify(sub))

      // Guardar la suscripción en Supabase
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId,
          endpoint: subData.endpoint,
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth,
        }),
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('Error al suscribir a notificaciones push:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported) return null

  return (
    <button
      onClick={subscribe}
      disabled={isSubscribed || loading}
      className="btn-secondary"
      style={{
        padding: '0.6rem 1rem',
        borderRadius: '8px',
        backgroundColor: isSubscribed ? '#1e293b' : '#CDF6F9',
        color: isSubscribed ? '#94a3b8' : '#0f1722',
        fontWeight: 600,
        border: 'none',
        cursor: isSubscribed ? 'default' : 'pointer'
      }}
    >
      {isSubscribed ? '✓ Notificaciones activas' : loading ? 'Activando...' : '🔔 Activar recordatorios'}
    </button>
  )
}
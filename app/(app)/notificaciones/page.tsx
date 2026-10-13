'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface PushNotificationItem {
  id: string
  title: string
  body?: string
  url?: string | null
  received_at: string
  read?: boolean
}

export default function NotificacionesPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  // Formato relativo de hora estilo centro de notificaciones
  function formatRelativeTime(dateStr?: string) {
    if (!dateStr) return 'Reciente'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return 'Reciente'
      const diffMs = Date.now() - d.getTime()
      const diffMinutes = Math.floor(diffMs / (1000 * 60))
      const diffHours = Math.floor(diffMinutes / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffMinutes < 1) return 'Ahora'
      if (diffMinutes < 60) return `Hace ${diffMinutes} min`
      if (diffHours < 24) return `Hace ${diffHours} h`
      if (diffDays === 1) return 'Ayer'
      return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
    } catch {
      return 'Reciente'
    }
  }

  // Carga del historial de Push
  useEffect(() => {
    try {
      const stored = localStorage.getItem('family_push_history')
      if (stored) {
        const parsed: PushNotificationItem[] = JSON.parse(stored)
        setNotifications(parsed)

        // Al abrir la pantalla, marcar todas como leídas para limpiar el badge
        const markedRead = parsed.map((item) => ({ ...item, read: true }))
        localStorage.setItem('family_push_history', JSON.stringify(markedRead))
        window.dispatchEvent(new Event('push_notifications_updated'))
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Borrar una notificación individual (estilo swipe / cerrar del celular)
  function handleDeleteOne(id: string) {
    const updated = notifications.filter((n) => n.id !== id)
    setNotifications(updated)
    localStorage.setItem('family_push_history', JSON.stringify(updated))
    window.dispatchEvent(new Event('push_notifications_updated'))
  }

  // Borrar todo el historial de notificaciones
  function handleClearAll() {
    if (notifications.length === 0) return
    if (!confirm('¿Deseas vaciar el historial de notificaciones?')) return

    setNotifications([])
    localStorage.removeItem('family_push_history')
    window.dispatchEvent(new Event('push_notifications_updated'))
  }

  return (
    <div className="w-full flex flex-col gap-6 select-none max-w-2xl mx-auto">
      {/* HEADER */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white m-0">
              Notificaciones
            </h1>
            {notifications.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#F76911]/20 border border-[#F76911]/30 text-[#F76911] text-[11px] font-bold">
                {notifications.length}
              </span>
            )}
          </div>
        </div>

        {notifications.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-bold text-neutral-400 hover:text-red-400 px-3 py-1.5 rounded-xl bg-[#1a1a1a] border border-neutral-800/80 active:scale-95 transition-all cursor-pointer"
          >
            Borrar todas
          </button>
        )}
      </header>

      {/* CONTENIDO */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 border-[#F76911] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-neutral-500 font-medium">Cargando avisos...</p>
        </div>
      ) : notifications.length === 0 ? (
        /* EMPTY STATE: Cuando no te ha llegado ninguna push o las borraste */
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-[32px] bg-[#1a1a1a]/60 border border-neutral-800/60 shadow-inner">
          <div className="w-20 h-20 rounded-full bg-[#131313] border border-neutral-800 flex items-center justify-center mb-4 shadow-md">
            <svg className="w-10 h-10 text-neutral-600 stroke-current stroke-1.5 fill-none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white m-0">No hay notificaciones</h2>
          <p className="text-xs text-neutral-500 max-w-xs mt-1.5 leading-relaxed">
            Aquí aparecerán los avisos y alertas push que reciba tu teléfono.
          </p>
          <Link
            href="/"
            className="mt-6 px-5 py-2.5 rounded-2xl bg-[#131313] hover:bg-neutral-800 border border-neutral-800 text-xs font-bold text-neutral-300 transition-all active:scale-95 cursor-pointer"
          >
            Volver al Inicio
          </Link>
        </div>
      ) : (
        /* LISTADO DE NOTIFICACIONES PUSH RECIBIDAS */
        <div className="flex flex-col gap-2.5">
          {notifications.map((item) => (
            <article
              key={item.id}
              className="group p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 hover:border-neutral-700 shadow-md transition-all flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <span className="w-10 h-10 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[#F76911] shrink-0 text-base">
                  🔔
                </span>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 pr-1">
                    <h3 className="text-sm font-bold text-white truncate m-0">
                      {item.title}
                    </h3>
                    <span className="text-[10px] text-neutral-500 whitespace-nowrap shrink-0 font-medium">
                      {formatRelativeTime(item.received_at)}
                    </span>
                  </div>

                  {item.body && (
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                      {item.body}
                    </p>
                  )}

                  {item.url && (
                    <Link
                      href={item.url}
                      className="text-[11px] text-[#F76911] font-bold mt-2 hover:underline inline-block w-fit"
                    >
                      Abrir enlace →
                    </Link>
                  )}
                </div>
              </div>

              {/* BOTÓN DESCARTAR (X) */}
              <button
                type="button"
                onClick={() => handleDeleteOne(item.id)}
                className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 hover:border-red-900/60 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0"
                title="Descartar notificación"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
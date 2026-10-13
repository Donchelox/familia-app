'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PushNotificationItem {
  id: string
  title: string
  body?: string
  url?: string | null
  received_at?: string
  read?: boolean
  tag?: string
}

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([])
  const [mounted, setMounted] = useState(false)

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

  function getNotificationIcon(item: PushNotificationItem) {
    const text = `${item.title || ''} ${item.body || ''} ${item.tag || ''}`.toLowerCase()
    if (text.includes('medicamento') || text.includes('dosis') || text.includes('med')) return '💊'
    if (text.includes('colegio') || text.includes('prueba') || text.includes('evaluación') || text.includes('tarea escolar')) return '🎒'
    if (text.includes('tarea') || text.includes('pendiente')) return '✅'
    if (text.includes('compra') || text.includes('feria') || text.includes('súper')) return '🛒'
    return '🔔'
  }

  function loadAndMarkRead() {
    try {
      const raw = localStorage.getItem('family_push_history')
      if (raw) {
        const parsed: PushNotificationItem[] = JSON.parse(raw)
        parsed.sort((a, b) => {
          const dateA = a.received_at ? new Date(a.received_at).getTime() : 0
          const dateB = b.received_at ? new Date(b.received_at).getTime() : 0
          return dateB - dateA
        })
        setNotifications(parsed)

        // Marcar todas como leídas para actualizar la campana
        const marked = parsed.map((item) => ({ ...item, read: true }))
        localStorage.setItem('family_push_history', JSON.stringify(marked))
        window.dispatchEvent(new Event('push_notifications_updated'))
      } else {
        setNotifications([])
      }
    } catch {
      setNotifications([])
    } finally {
      setMounted(true)
    }
  }

  useEffect(() => {
    loadAndMarkRead()
  }, [])

  function handleDeleteOne(id: string) {
    const updated = notifications.filter((n) => n.id !== id)
    setNotifications(updated)
    localStorage.setItem('family_push_history', JSON.stringify(updated))
    window.dispatchEvent(new Event('push_notifications_updated'))
  }

  function handleClearAll() {
    if (notifications.length === 0) return
    if (!confirm('¿Deseas vaciar el historial de notificaciones?')) return

    setNotifications([])
    localStorage.removeItem('family_push_history')
    window.dispatchEvent(new Event('push_notifications_updated'))
  }

  if (!mounted) {
    return (
      <main className="w-full min-h-screen bg-[#121212] flex items-center justify-center p-6 text-neutral-400">
        <div className="w-8 h-8 border-2 border-[#F76911] border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
    <main className="w-full min-h-screen bg-[#121212] text-white p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* HEADER */}
        <header className="flex items-center justify-between py-2 border-b border-neutral-800/80">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#F76911] bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer no-underline"
            >
              <svg className="w-6 h-6 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white m-0">
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
              className="text-xs font-bold text-neutral-400 hover:text-red-400 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 active:scale-95 transition-all cursor-pointer"
            >
              Borrar todo
            </button>
          )}
        </header>

        {/* LISTADO O ESTADO VACÍO */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 mt-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl mb-4">
              🔔
            </div>
            <h2 className="text-base font-bold text-white m-0">No hay notificaciones recibidas</h2>
            <p className="text-xs text-neutral-400 max-w-xs mt-1.5 leading-relaxed">
              Los avisos push de dosis, tareas y eventos que lleguen al dispositivo se guardarán aquí.
            </p>
            <Link
              href="/"
              className="mt-6 px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/60 text-xs font-bold text-neutral-200 transition-all no-underline"
            >
              Volver al Inicio
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((item) => (
              <article
                key={item.id}
                className="p-4 rounded-[22px] bg-[#1a1a1a] border border-neutral-800/90 shadow-sm flex items-start justify-between gap-3.5"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="w-10 h-10 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 text-lg">
                    {getNotificationIcon(item)}
                  </span>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white truncate m-0">
                        {item.title}
                      </h3>
                      <span className="text-[10px] text-neutral-500 whitespace-nowrap shrink-0">
                        {formatRelativeTime(item.received_at)}
                      </span>
                    </div>

                    {item.body && (
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed m-0">
                        {item.body}
                      </p>
                    )}

                    {item.url && (
                      <Link
                        href={item.url}
                        className="text-[11px] text-[#F76911] font-bold mt-2.5 hover:underline inline-block w-fit no-underline"
                      >
                        Ver detalle →
                      </Link>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteOne(item.id)}
                  className="w-8 h-8 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Eliminar notificación"
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
    </main>
  )
}
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  if (!res.ok) throw new Error('No se pudo registrar la suscripción en el servidor')
}

export default function OnboardingNotificationsStep() {
  const router = useRouter()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isIos, setIsIos] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsIos(/iPad|iPhone|iPod/.test(navigator.userAgent))

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }

    setPermission(Notification.permission)
    if (Notification.permission === 'granted') {
      setSuccess(true)
    }
  }, [])

  async function handleEnableNotifications() {
    setBusy(true)
    setErrorMsg('')

    try {
      if (!('Notification' in window)) {
        throw new Error('Este navegador no soporta notificaciones.')
      }

      const res = await Notification.requestPermission()
      setPermission(res)

      if (res === 'granted') {
        // Registrar Service Worker si no está activo
        const reg = await navigator.serviceWorker.ready
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

        if (vapidKey) {
          try {
            const existingSub = await reg.pushManager.getSubscription()
            const sub =
              existingSub ||
              (await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
              }))
            await saveSubscription(sub)
          } catch (subErr) {
            console.debug('[OnboardingPush] Error suscribiendo a push:', subErr)
          }
        }

        setSuccess(true)
      } else if (res === 'denied') {
        setErrorMsg('Las notificaciones fueron bloqueadas en el navegador.')
      }
    } catch (err: any) {
      console.error('[OnboardingNotifications] Error al solicitar permiso:', err)
      setErrorMsg(err.message || 'No se pudo activar las notificaciones.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#131313] flex flex-col items-center justify-center p-4 text-white">
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        {/* CABECERA */}
        <header className="flex flex-col items-center text-center gap-3">
          <div
            style={orangeGradient}
            className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-[0_8px_24px_rgba(247,105,17,0.35)] shrink-0"
          >
            <svg
              className="w-8 h-8 text-white stroke-current stroke-[2.2] fill-none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest text-[#F76911] uppercase">
              Paso imprescindible
            </span>
            <h1 className="text-2xl font-black tracking-tight text-white m-0 mt-1">
              Activa tus notificaciones
            </h1>
            <p className="text-xs text-neutral-400 mt-2 font-medium leading-relaxed max-w-[340px]">
              Para no olvidar las tomas de medicamentos, los bloques del horario escolar y las tareas familiares, necesitas tener las notificaciones push aprobadas en tu dispositivo.
            </p>
          </div>
        </header>

        {/* TARJETA DE ACCIÓN */}
        <section className="p-6 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-2xl flex flex-col gap-5">
          {success || permission === 'granted' ? (
            <div className="flex flex-col items-center text-center gap-4 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-base font-bold text-white m-0">¡Notificaciones aprobadas!</h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Tu dispositivo está configurado correctamente para recibir los recordatorios de tu hogar.
                </p>
              </div>

              <Link
                href="/"
                style={orangeGradient}
                className="w-full py-3.5 mt-2 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 no-underline"
              >
                Entrar a mi hogar
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex flex-col gap-4 text-center py-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-bold">
                !
              </div>
              <div>
                <h3 className="text-base font-bold text-white m-0">Notificaciones bloqueadas</h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  Están desactivadas en la configuración de tu navegador. Para recibirlas, permite las notificaciones en el icono de candado o ajustes del navegador.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Link
                  href="/"
                  className="w-full py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 no-underline"
                >
                  Continuar al inicio
                </Link>
                <Link
                  href="/notificaciones"
                  className="text-xs font-bold text-[#F76911] hover:underline py-1 no-underline"
                >
                  Ir al centro de notificaciones
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-start gap-3">
                <span className="text-xl shrink-0">🔔</span>
                <div className="text-xs text-neutral-300 leading-relaxed">
                  <b className="text-white block mb-0.5">Alertas prioritarias</b>
                  Recordatorios automáticos en tu pantalla de bloqueo para medicamentos programados y pruebas escolares.
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-900/30 border border-red-800 text-red-200 text-xs">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={busy}
                style={orangeGradient}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm shadow-[0_4px_16px_rgba(247,105,17,0.3)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <span>Aprobando permisos...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    Aprobar y activar notificaciones
                  </>
                )}
              </button>

              <div className="flex flex-col items-center gap-2 pt-1 text-center">
                <Link
                  href="/"
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors py-1 no-underline"
                >
                  Omitir por ahora y entrar a mi hogar
                </Link>
                <Link
                  href="/notificaciones"
                  className="text-[11px] font-medium text-[#F76911]/80 hover:text-[#F76911] transition-colors no-underline"
                >
                  Ver centro de notificaciones
                </Link>
              </div>
            </div>
          )}

          {isIos && (
            <div className="pt-2 border-t border-neutral-800/60 text-[11px] text-neutral-400 leading-relaxed text-center">
              💡 <b>Tip iOS:</b> En iPhone o iPad, pulsa <b className="text-white">Compartir</b> y selecciona <b className="text-white">Añadir a pantalla de inicio</b> para recibir notificaciones push en segundo plano.
            </div>
          )}
        </section>

        {/* NOTA AL PIE */}
        <footer className="text-center px-4">
          <p className="text-[11px] text-neutral-500 leading-relaxed font-medium m-0">
            Podrás gestionar o desactivar tus notificaciones en cualquier momento desde los Ajustes de la app.
          </p>
        </footer>
      </div>
    </div>
  )
}

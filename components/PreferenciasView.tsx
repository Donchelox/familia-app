'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import PushSubscriptionManager from '@/components/PushSubscriptionManager'
import { updatePreferences } from '@/app/actions/members'

interface PreferenciasViewProps {
  familyId: string
  initialMedReminders?: boolean
  initialMorningSummary?: boolean
}

export default function PreferenciasView({
  initialMedReminders = true,
  initialMorningSummary = true,
}: PreferenciasViewProps) {
  const [medReminders, setMedReminders] = useState<boolean>(initialMedReminders)
  const [morningSummary, setMorningSummary] = useState<boolean>(initialMorningSummary)
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<string>('')

  const handleToggleMedReminders = () => {
    const nextVal = !medReminders
    setMedReminders(nextVal)
    setStatusMessage('Guardando cambios...')
    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(nextVal))
      fd.append('morningSummary', String(morningSummary))
      await updatePreferences(fd)
      setStatusMessage(nextVal ? '✓ Recordatorios de medicinas activados' : '✓ Recordatorios de medicinas pausados')
      setTimeout(() => setStatusMessage(''), 3000)
    })
  }

  const handleToggleMorningSummary = () => {
    const nextVal = !morningSummary
    setMorningSummary(nextVal)
    setStatusMessage('Guardando cambios...')
    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(medReminders))
      fd.append('morningSummary', String(nextVal))
      await updatePreferences(fd)
      setStatusMessage(nextVal ? '✓ Resumen matutino activado' : '✓ Resumen matutino pausado')
      setTimeout(() => setStatusMessage(''), 3000)
    })
  }

  return (
    <div className="w-full flex flex-col gap-6 relative min-h-[calc(100vh-80px)] pb-16 select-none">
      {/* 1. HEADER */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/ajustes"
            aria-label="Volver a ajustes"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">Preferencias</h1>
            <p className="text-xs text-neutral-400 font-medium m-0">Recordatorios y notificaciones</p>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* 2. MENSAJE DE ESTADO */}
      {statusMessage && (
        <div className="p-3 rounded-2xl bg-[#1f1a14] border border-[#F76911]/30 text-[#F2A957] text-xs font-semibold flex items-center justify-between">
          <span>{statusMessage}</span>
          {isPending && <span className="animate-pulse text-[10px]">Guardando...</span>}
        </div>
      )}

      {/* 3. SECCIÓN: TOGGLES DE CONFIGURACIÓN */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Avisos Familiares
        </span>

        <div className="p-5 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-5">
          {/* Recordatorios de Medicinas */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/60 pb-4">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm">💊</span>
                <p className="text-sm font-bold text-white leading-tight m-0">Recordatorios de Medicinas</p>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Avisos push automáticos en cada horario. Si no confirmas la dosis, te recordará cada 5 minutos por hasta 2 horas.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={medReminders}
              onClick={handleToggleMedReminders}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                medReminders ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  medReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Resumen Matutino */}
          <div className="flex items-center justify-between py-1">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm">🌅</span>
                <p className="text-sm font-bold text-white leading-tight m-0">Resumen Matutino</p>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Recibe a las 08:00 hrs un resumen con las tareas pendientes y pruebas escolares del día.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={morningSummary}
              onClick={handleToggleMorningSummary}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                morningSummary ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  morningSummary ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 4. SECCIÓN: ESTADO DEL DISPOSITIVO (PUSH) */}
      <section className="flex flex-col gap-2 pt-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Dispositivo Actual
        </span>

        <PushSubscriptionManager />
      </section>
    </div>
  )
}

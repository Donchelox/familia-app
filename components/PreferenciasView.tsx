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
  initialMedReminderInterval?: number
}

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
]

export default function PreferenciasView({
  initialMedReminders = true,
  initialMorningSummary = true,
  initialMedReminderInterval = 5,
}: PreferenciasViewProps) {
  const [medReminders, setMedReminders] = useState<boolean>(initialMedReminders)
  const [morningSummary, setMorningSummary] = useState<boolean>(initialMorningSummary)
  const [interval, setInterval] = useState<number>(initialMedReminderInterval)
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
      fd.append('medReminderInterval', String(interval))
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
      fd.append('medReminderInterval', String(interval))
      await updatePreferences(fd)
      setStatusMessage(nextVal ? '✓ Resumen matutino activado' : '✓ Resumen matutino pausado')
      setTimeout(() => setStatusMessage(''), 3000)
    })
  }

  const handleSelectInterval = (newInterval: number) => {
    setInterval(newInterval)
    setStatusMessage(`Guardando recurrencia de ${newInterval} min...`)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(medReminders))
      fd.append('morningSummary', String(morningSummary))
      fd.append('medReminderInterval', String(newInterval))
      await updatePreferences(fd)
      setStatusMessage(`✓ Recurrencia actualizada a cada ${newInterval} minutos`)
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
        <div className="p-3 rounded-2xl bg-[#1f1a14] border border-[#F76911]/30 text-[#F2A957] text-xs font-semibold flex items-center justify-between shadow-sm">
          <span>{statusMessage}</span>
          {isPending && <span className="animate-pulse text-[10px] text-neutral-400">Guardando...</span>}
        </div>
      )}

      {/* 3. SECCIÓN: TOGGLES DE CONFIGURACIÓN */}
      <section className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Avisos Familiares
        </span>

        <div className="p-5 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-5">
          {/* Recordatorios de Medicinas */}
          <div className="flex flex-col gap-3.5 border-b border-neutral-800/60 pb-5">
            <div className="flex items-center justify-between py-1">
              <div className="pr-4 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm">💊</span>
                  <p className="text-sm font-bold text-white leading-tight m-0">Recordatorios de Medicinas</p>
                </div>
                <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                  Avisos push automáticos en cada horario. Si no confirmas la toma, volverá a notificar según la recurrencia elegida (por hasta 2 horas).
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={medReminders}
                onClick={handleToggleMedReminders}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out hover:scale-105 active:scale-90 focus:outline-none ${
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

            {/* Opciones de Recurrencia (5, 10, 15, 30 minutos) */}
            {medReminders && (
              <div className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Recurrencia de reintento</span>
                    <span className="text-[11px] text-neutral-400">¿Cada cuánto insistir si no se marca tomada?</span>
                  </div>
                  <span className="text-[11px] font-black text-[#F76911] bg-[#F76911]/15 px-2 py-0.5 rounded-md border border-[#F76911]/30">
                    {interval} min
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectInterval(opt.value)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border flex items-center justify-center ${
                        interval === opt.value
                          ? 'bg-[#F76911] border-[#F76911] text-white shadow-[0_2px_10px_rgba(247,105,17,0.3)]'
                          : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out hover:scale-105 active:scale-90 focus:outline-none ${
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

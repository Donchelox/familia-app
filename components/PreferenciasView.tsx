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
  initialMorningSummaryTime?: string
  initialSchoolReminders?: boolean
  initialSchoolReminderTime?: string
  initialFeriaReminders?: boolean
  initialFeriaDays?: string[]
  initialFeriaTime?: string
  initialSuperReminders?: boolean
  initialSuperTime?: string
}

const INTERVAL_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
]

const MORNING_TIME_PRESETS = ['06:30', '07:00', '07:30', '08:00', '08:30']
const SCHOOL_TIME_PRESETS = ['07:00', '07:30', '08:00', '16:00']
const FERIA_TIME_PRESETS = ['06:30', '07:00', '07:30', '08:00', '08:30']
const SUPER_TIME_PRESETS = ['10:00', '12:00', '17:00', '18:00', '19:00']
const ALL_WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function PreferenciasView({
  initialMedReminders = true,
  initialMorningSummary = true,
  initialMedReminderInterval = 5,
  initialMorningSummaryTime = '07:00',
  initialSchoolReminders = true,
  initialSchoolReminderTime = '07:30',
  initialFeriaReminders = true,
  initialFeriaDays = ['Jueves', 'Domingo'],
  initialFeriaTime = '07:00',
  initialSuperReminders = true,
  initialSuperTime = '18:00',
}: PreferenciasViewProps) {
  const [medReminders, setMedReminders] = useState<boolean>(initialMedReminders)
  const [morningSummary, setMorningSummary] = useState<boolean>(initialMorningSummary)
  const [interval, setInterval] = useState<number>(initialMedReminderInterval)
  const [summaryTime, setSummaryTime] = useState<string>(initialMorningSummaryTime)

  // Colegio
  const [schoolReminders, setSchoolReminders] = useState<boolean>(initialSchoolReminders)
  const [schoolTime, setSchoolTime] = useState<string>(initialSchoolReminderTime)

  // Feria
  const [feriaReminders, setFeriaReminders] = useState<boolean>(initialFeriaReminders)
  const [feriaDays, setFeriaDays] = useState<string[]>(initialFeriaDays)
  const [feriaTime, setFeriaTime] = useState<string>(initialFeriaTime)

  // Super
  const [superReminders, setSuperReminders] = useState<boolean>(initialSuperReminders)
  const [superTime, setSuperTime] = useState<string>(initialSuperTime)

  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<string>('')

  // Función unificada para guardar
  const saveState = (
    overrides?: Partial<{
      medReminders: boolean
      morningSummary: boolean
      interval: number
      summaryTime: string
      schoolReminders: boolean
      schoolTime: string
      feriaReminders: boolean
      feriaDays: string[]
      feriaTime: string
      superReminders: boolean
      superTime: string
    }>,
    msg?: string
  ) => {
    const nextMed = overrides?.medReminders ?? medReminders
    const nextSummary = overrides?.morningSummary ?? morningSummary
    const nextInterval = overrides?.interval ?? interval
    const nextSummaryTime = overrides?.summaryTime ?? summaryTime
    const nextSchool = overrides?.schoolReminders ?? schoolReminders
    const nextSchoolTime = overrides?.schoolTime ?? schoolTime
    const nextFeria = overrides?.feriaReminders ?? feriaReminders
    const nextFeriaDays = overrides?.feriaDays ?? feriaDays
    const nextFeriaTime = overrides?.feriaTime ?? feriaTime
    const nextSuper = overrides?.superReminders ?? superReminders
    const nextSuperTime = overrides?.superTime ?? superTime

    if (msg) setStatusMessage(msg)
    else setStatusMessage('Guardando cambios...')

    startTransition(async () => {
      const fd = new FormData()
      fd.append('medReminders', String(nextMed))
      fd.append('morningSummary', String(nextSummary))
      fd.append('medReminderInterval', String(nextInterval))
      fd.append('morningSummaryTime', nextSummaryTime)

      fd.append('schoolReminders', String(nextSchool))
      fd.append('schoolReminderTime', nextSchoolTime)

      fd.append('feriaReminders', String(nextFeria))
      fd.append('feriaDays', nextFeriaDays.join(','))
      fd.append('feriaTime', nextFeriaTime)

      fd.append('superReminders', String(nextSuper))
      fd.append('superTime', nextSuperTime)

      await updatePreferences(fd)
      if (msg) setStatusMessage(`✓ ${msg}`)
      else setStatusMessage('✓ Preferencias actualizadas correctamente')
      setTimeout(() => setStatusMessage(''), 3000)
    })
  }

  // Handlers Medicinas
  const handleToggleMedReminders = () => {
    const next = !medReminders
    setMedReminders(next)
    saveState({ medReminders: next }, next ? 'Recordatorios de medicinas activados' : 'Recordatorios de medicinas pausados')
  }

  const handleSelectInterval = (val: number) => {
    setInterval(val)
    saveState({ interval: val }, `Recurrencia actualizada a cada ${val} minutos`)
  }

  // Handlers Resumen Matutino
  const handleToggleMorningSummary = () => {
    const next = !morningSummary
    setMorningSummary(next)
    saveState({ morningSummary: next }, next ? 'Resumen matutino activado' : 'Resumen matutino pausado')
  }

  const handleSelectSummaryTime = (val: string) => {
    setSummaryTime(val)
    saveState({ summaryTime: val }, `Horario de resumen guardado para las ${val} hrs`)
  }

  // Handlers Colegio
  const handleToggleSchool = () => {
    const next = !schoolReminders
    setSchoolReminders(next)
    saveState({ schoolReminders: next }, next ? 'Avisos de colegio activados' : 'Avisos de colegio pausados')
  }

  const handleSelectSchoolTime = (val: string) => {
    setSchoolTime(val)
    saveState({ schoolTime: val }, `Horario de aviso escolar fijado a las ${val} hrs`)
  }

  // Handlers Feria
  const handleToggleFeria = () => {
    const next = !feriaReminders
    setFeriaReminders(next)
    saveState({ feriaReminders: next }, next ? 'Recordatorios de feria activados' : 'Recordatorios de feria pausados')
  }

  const handleToggleFeriaDay = (day: string) => {
    const nextDays = feriaDays.includes(day)
      ? feriaDays.filter((d) => d !== day)
      : [...feriaDays, day]
    if (nextDays.length === 0) return // mínimo un día
    setFeriaDays(nextDays)
    saveState({ feriaDays: nextDays }, `Días de feria: ${nextDays.join(', ')}`)
  }

  const handleSelectFeriaTime = (val: string) => {
    setFeriaTime(val)
    saveState({ feriaTime: val }, `Horario de feria fijado a las ${val} hrs`)
  }

  // Handlers Super
  const handleToggleSuper = () => {
    const next = !superReminders
    setSuperReminders(next)
    saveState({ superReminders: next }, next ? 'Avisos de supermercado activados' : 'Avisos de supermercado pausados')
  }

  const handleSelectSuperTime = (val: string) => {
    setSuperTime(val)
    saveState({ superTime: val }, `Horario de supermercado fijado a las ${val} hrs`)
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
            <p className="text-xs text-neutral-400 font-medium m-0">Recordatorios y notificaciones automáticas</p>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* 2. MENSAJE DE ESTADO */}
      {statusMessage && (
        <div className="p-3 rounded-2xl bg-[#1f1a14] border border-[#F76911]/30 text-[#F2A957] text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <span>{statusMessage}</span>
          {isPending && <span className="animate-pulse text-[10px] text-neutral-400">Guardando...</span>}
        </div>
      )}

      {/* 3. SECCIÓN: TOGGLES Y CONFIGURACIONES DE RECORDATORIOS */}
      <section className="flex flex-col gap-4">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
          Canales de Notificaciones Push
        </span>

        {/* 1. MÓDULO: MEDICAMENTOS */}
        <div className="p-5 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg">💊</span>
                <h3 className="text-sm font-bold text-white leading-tight m-0">Medicamentos</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Avisos en cada horario fijado. Si no confirmas la toma, insistirá según el reintento configurado.
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

        {/* 2. MÓDULO: RESUMEN MATUTINO */}
        <div className="p-5 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌅</span>
                <h3 className="text-sm font-bold text-white leading-tight m-0">Resumen Matutino Diario</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Aviso matutino para empezar el día con el resumen completo: &quot;Este día tienes...&quot;
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

          {morningSummary && (
            <div className="p-4 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Hora de notificación</span>
                  <span className="text-[11px] text-neutral-400">Por defecto a las 07:00 AM o la hora que elijas</span>
                </div>
                <span className="text-[12px] font-black text-[#F76911] bg-[#F76911]/15 px-2.5 py-1 rounded-lg border border-[#F76911]/30">
                  {summaryTime} hrs
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {MORNING_TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectSummaryTime(t)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      summaryTime === t
                        ? 'bg-[#F76911] border-[#F76911] text-white shadow-[0_2px_10px_rgba(247,105,17,0.3)]'
                        : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <span>{t}</span>
                    {t === '07:00' && <span className="text-[9px] font-medium opacity-80">Por defecto</span>}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
                <label htmlFor="custom-summary-time" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Personalizar hora exacta:
                </label>
                <input
                  id="custom-summary-time"
                  type="time"
                  value={summaryTime}
                  onChange={(e) => {
                    if (e.target.value) handleSelectSummaryTime(e.target.value)
                  }}
                  className="bg-[#1a1a1a] border border-neutral-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:border-[#F76911] focus:outline-none cursor-pointer"
                />
              </div>

              <Link
                href="/resumen"
                className="mt-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-[#F2A957] hover:bg-neutral-850 hover:border-[#F76911]/50 text-xs font-bold transition-all duration-150 active:scale-[0.98] no-underline group"
              >
                <span>Ver página: &quot;Este día tienes:&quot;</span>
                <span className="text-[#F76911] transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </Link>
            </div>
          )}
        </div>

        {/* 3. MÓDULO: COLEGIO (PRUEBAS Y TAREAS) */}
        <div className="p-5 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <h3 className="text-sm font-bold text-white leading-tight m-0">Colegio (Pruebas y Tareas)</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Aviso matutino si hay prueba o tarea escolar con entrega hoy.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={schoolReminders}
              onClick={handleToggleSchool}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out hover:scale-105 active:scale-90 focus:outline-none ${
                schoolReminders ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  schoolReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {schoolReminders && (
            <div className="p-4 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Hora de aviso escolar</span>
                  <span className="text-[11px] text-neutral-400">Antes de iniciar la jornada escolar</span>
                </div>
                <span className="text-[12px] font-black text-[#F76911] bg-[#F76911]/15 px-2.5 py-1 rounded-lg border border-[#F76911]/30">
                  {schoolTime} hrs
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SCHOOL_TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectSchoolTime(t)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      schoolTime === t
                        ? 'bg-[#F76911] border-[#F76911] text-white shadow-[0_2px_10px_rgba(247,105,17,0.3)]'
                        : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <span>{t}</span>
                    {t === '07:30' && <span className="text-[9px] font-medium opacity-80">Por defecto</span>}
                  </button>
                ))}
              </div>

              {/* Nota de la regla de las 20:00 hrs para pruebas */}
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5">
                <span className="text-sm">ℹ️</span>
                <p className="text-[11px] text-neutral-300 leading-relaxed m-0">
                  <strong>Regla de pruebas:</strong> La prueba escolar del día se oculta y elimina automáticamente del listado a las <strong>20:00 hrs (8:00 PM)</strong> al terminar las clases, y ya no figurará en los días posteriores.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 4. MÓDULO: FERIA LIBRE */}
        <div className="p-5 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg">🥬</span>
                <h3 className="text-sm font-bold text-white leading-tight m-0">Feria Libre</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Notificación los días de feria para recordar las compras de verduras, frutas y abarrotes.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={feriaReminders}
              onClick={handleToggleFeria}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out hover:scale-105 active:scale-90 focus:outline-none ${
                feriaReminders ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  feriaReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {feriaReminders && (
            <div className="p-4 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-3.5 animate-in fade-in duration-200">
              {/* Días de feria */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Días de feria</span>
                  <span className="text-[11px] text-[#F76911] font-semibold">
                    {feriaDays.join(', ')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_WEEKDAYS.map((d) => {
                    const isSelected = feriaDays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleToggleFeriaDay(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer border ${
                          isSelected
                            ? 'bg-[#F76911] border-[#F76911] text-white shadow-sm'
                            : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {d}
                        {(d === 'Jueves' || d === 'Domingo') && !isSelected && (
                          <span className="text-[9px] ml-1 opacity-60">•</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <span className="text-[10px] text-neutral-500">
                  Por defecto: Jueves y Domingo (puedes activar o quitar días según tu sector).
                </span>
              </div>

              {/* Hora de feria */}
              <div className="pt-2 border-t border-neutral-800/80 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Hora de aviso</span>
                  <span className="text-[12px] font-black text-[#F76911] bg-[#F76911]/15 px-2.5 py-1 rounded-lg border border-[#F76911]/30">
                    {feriaTime} hrs
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {FERIA_TIME_PRESETS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectFeriaTime(t)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                        feriaTime === t
                          ? 'bg-[#F76911] border-[#F76911] text-white shadow-[0_2px_10px_rgba(247,105,17,0.3)]'
                          : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span>{t}</span>
                      {t === '07:00' && <span className="text-[9px] font-medium opacity-80">Por defecto</span>}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label htmlFor="custom-feria-time" className="text-xs text-neutral-300 font-medium cursor-pointer">
                    Personalizar hora:
                  </label>
                  <input
                    id="custom-feria-time"
                    type="time"
                    value={feriaTime}
                    onChange={(e) => {
                      if (e.target.value) handleSelectFeriaTime(e.target.value)
                    }}
                    className="bg-[#1a1a1a] border border-neutral-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:border-[#F76911] focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. MÓDULO: SUPERMERCADO */}
        <div className="p-5 rounded-[28px] bg-[#1a1a1a] border border-neutral-800/80 shadow-md flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="pr-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <h3 className="text-sm font-bold text-white leading-tight m-0">Supermercado</h3>
              </div>
              <p className="text-xs text-neutral-400 mt-1 leading-snug m-0">
                Aviso si tienes productos pendientes de compra en la lista del supermercado.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={superReminders}
              onClick={handleToggleSuper}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 ease-in-out hover:scale-105 active:scale-90 focus:outline-none ${
                superReminders ? 'bg-[#F76911]' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  superReminders ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {superReminders && (
            <div className="p-4 rounded-2xl bg-[#131313] border border-neutral-800 flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">Hora de aviso</span>
                  <span className="text-[11px] text-neutral-400">Recordatorio para pasar al supermercado</span>
                </div>
                <span className="text-[12px] font-black text-[#F76911] bg-[#F76911]/15 px-2.5 py-1 rounded-lg border border-[#F76911]/30">
                  {superTime} hrs
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {SUPER_TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectSuperTime(t)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      superTime === t
                        ? 'bg-[#F76911] border-[#F76911] text-white shadow-[0_2px_10px_rgba(247,105,17,0.3)]'
                        : 'bg-[#1a1a1a] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <span>{t}</span>
                    {t === '18:00' && <span className="text-[9px] font-medium opacity-80">Por defecto</span>}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label htmlFor="custom-super-time" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Personalizar hora:
                </label>
                <input
                  id="custom-super-time"
                  type="time"
                  value={superTime}
                  onChange={(e) => {
                    if (e.target.value) handleSelectSuperTime(e.target.value)
                  }}
                  className="bg-[#1a1a1a] border border-neutral-700 text-white font-bold text-xs rounded-xl px-2.5 py-1.5 focus:border-[#F76911] focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          )}
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

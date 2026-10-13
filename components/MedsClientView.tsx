'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/NotificationBell'
import { recordActivity } from '@/lib/audit'

export interface Medication {
  id: string
  name: string
  dose: string
  times: string[]
  person: string
  frequency?: string
  end_date?: string | null
}

interface Member {
  id: string
  name: string
}

interface Props {
  familyId: string
  meds: Medication[]
  members: Member[]
  takenKeys: string[]
  todayStr: string
  currentHM: string
}

const DAYS_OF_WEEK = [
  { id: 1, label: 'L', name: 'Lun' },
  { id: 2, label: 'M', name: 'Mar' },
  { id: 3, label: 'X', name: 'Mié' },
  { id: 4, label: 'J', name: 'Jue' },
  { id: 5, label: 'V', name: 'Vie' },
  { id: 6, label: 'S', name: 'Sáb' },
  { id: 7, label: 'D', name: 'Dom' },
]

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Todos los días' },
  { value: 'custom_days', label: 'Días específicos de la semana' },
  { value: 'every_8h', label: 'Cada 8 horas' },
  { value: 'every_12h', label: 'Cada 12 horas' },
  { value: 'weekdays', label: 'Lunes a Viernes' },
  { value: 'weekends', label: 'Fines de semana' },
  { value: 'as_needed', label: 'Según necesidad (SOS)' },
]

export default function MedsClientView({
  familyId,
  meds,
  members,
  takenKeys: initialTakenKeys,
  todayStr,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [takenKeys, setTakenKeys] = useState<Set<string>>(new Set(initialTakenKeys))
  const [selectedPerson, setSelectedPerson] = useState<string>('todos')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Formulario Crear / Editar
  const defaultMemberName = members[0]?.name || 'Marcelo Vásquez'
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [dose, setDose] = useState('')
  const [person, setPerson] = useState(defaultMemberName)
  const [time, setTime] = useState('08:00')
  const [frequency, setFrequency] = useState('daily')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]) // L, M, V por defecto
  const [endDate, setEndDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  // Día de la semana actual según estándar ISO (1 = Lunes ... 7 = Domingo)
  const currentIsoDay = (() => {
    const d = new Date().getDay()
    return d === 0 ? 7 : d
  })()

  function toggleDay(dayId: number) {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort()
    )
  }

  function openCreateModal() {
    setEditingId(null)
    setName('')
    setDose('')
    setPerson(defaultMemberName)
    setTime('08:00')
    setFrequency('daily')
    setSelectedDays([1, 3, 5])
    setEndDate('')
    setIsModalOpen(true)
  }

  function openEditModal(med: Medication) {
    setEditingId(med.id)
    setName(med.name)
    setDose(med.dose || '')
    setPerson(med.person || defaultMemberName)
    setTime(med.times?.[0] || '08:00')
    setEndDate(med.end_date || '')

    if (med.frequency?.startsWith('days:')) {
      setFrequency('custom_days')
      const days = med.frequency.replace('days:', '').split(',').map(Number)
      setSelectedDays(days)
    } else {
      setFrequency(med.frequency || 'daily')
      setSelectedDays([1, 3, 5])
    }

    setIsModalOpen(true)
  }

  const allDoses = meds
    .filter((med) => {
      const freq = med.frequency || 'daily'
      if (freq === 'daily' || freq === 'every_8h' || freq === 'every_12h' || freq === 'as_needed') return true
      if (freq === 'weekdays') return currentIsoDay >= 1 && currentIsoDay <= 5
      if (freq === 'weekends') return currentIsoDay === 6 || currentIsoDay === 7
      if (freq.startsWith('days:')) {
        const days = freq.replace('days:', '').split(',').map(Number)
        return days.includes(currentIsoDay)
      }
      return true
    })
    .flatMap((med) =>
      (med.times || []).map((t) => {
        const doseKey = `${med.id}_${t}`
        return {
          key: doseKey,
          medId: med.id,
          med,
          name: med.name,
          dose: med.dose,
          person: med.person || 'General',
          time: t,
          frequency: med.frequency || 'daily',
          endDate: med.end_date,
          isTaken: takenKeys.has(doseKey),
        }
      })
    )
    .sort((a, b) => a.time.localeCompare(b.time))

  const filteredDoses =
    selectedPerson === 'todos'
      ? allDoses
      : allDoses.filter((d) => d.person.toLowerCase() === selectedPerson.toLowerCase())

  const totalDoses = filteredDoses.length
  const completedDoses = filteredDoses.filter((d) => d.isTaken).length

  const availableFilterPersons = Array.from(
    new Set([
      ...members.map((m) => m.name),
      ...meds.map((m) => m.person).filter(Boolean),
    ])
  )

  // Marcar / desmarcar toma
  async function toggleDose(medId: string, doseTime: string, currentTaken: boolean) {
    const key = `${medId}_${doseTime}`
    setLoadingAction(key)

    const targetMed = meds.find((m) => m.id === medId)
    const updated = new Set(takenKeys)

    if (currentTaken) {
      updated.delete(key)
      setTakenKeys(updated)
      await supabase
        .from('dose_logs')
        .delete()
        .eq('family_id', familyId)
        .eq('medication_id', medId)
        .eq('time', doseTime)
        .eq('day', todayStr)
    } else {
      updated.add(key)
      setTakenKeys(updated)
      await supabase.from('dose_logs').insert({
        family_id: familyId,
        medication_id: medId,
        time: doseTime,
        day: todayStr,
      })
    }

    // Registro de auditoría
    try {
      await recordActivity(supabase, {
        familyId,
        actorName: targetMed?.person || 'Familiar',
        entity: 'dose',
        entityId: medId,
        action: 'toggle',
        title: `Dosis ${currentTaken ? 'desmarcada' : 'tomada'}: ${targetMed?.name || 'Medicamento'}`,
        scheduledAt: `Programada a las ${doseTime} hrs (Día: ${todayStr})`,
        details: { doseTime, day: todayStr },
      })
    } catch (auditErr) {
      console.error('Error registrando auditoría de dosis:', auditErr)
    }

    setLoadingAction(null)
    router.refresh()
  }

  // Guardar (Crear o Actualizar)
  async function handleSaveMed(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setIsSaving(true)

    const finalFrequency =
      frequency === 'custom_days'
        ? `days:${selectedDays.join(',')}`
        : frequency

    const payload = {
      family_id: familyId,
      name: name.trim(),
      dose: dose.trim(),
      person: person.trim() || defaultMemberName,
      times: [time || '08:00'],
      frequency: finalFrequency,
      end_date: endDate ? endDate : null,
    }

    try {
      let currentEntityId = editingId

      if (editingId) {
        await supabase
          .from('medications')
          .update(payload)
          .eq('id', editingId)
          .eq('family_id', familyId)
      } else {
        const { data: insertedMed } = await supabase
          .from('medications')
          .insert(payload)
          .select()
          .single()

        currentEntityId = insertedMed?.id || 'new'
      }

      // Registro de auditoría
      await recordActivity(supabase, {
        familyId,
        actorName: payload.person,
        entity: 'medication',
        entityId: currentEntityId || 'new',
        action: editingId ? 'update' : 'create',
        title: `Medicamento: ${payload.name} (${payload.dose || 'sin dosis'})`,
        scheduledAt: `Horarios: ${payload.times.join(', ')} hrs`,
        details: {
          person: payload.person,
          times: payload.times,
          frequency: payload.frequency,
          endDate: payload.end_date,
        },
      })
    } catch (err) {
      console.error('Error al guardar medicamento con log:', err)
    }

    setIsSaving(false)
    setIsModalOpen(false)
    router.refresh()
  }

  async function handleDeleteMed() {
    if (!editingId) return
    if (!confirm(`¿Deseas eliminar el recordatorio de "${name}"?`)) return
    setIsDeleting(true)

    await supabase
      .from('medications')
      .delete()
      .eq('id', editingId)
      .eq('family_id', familyId)

    setIsDeleting(false)
    setIsModalOpen(false)
    router.refresh()
  }

  return (
    <div className="w-full flex flex-col gap-6 select-none">
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer"
          >
            <svg
              className="w-7 h-7 stroke-current stroke-[2.5] fill-none"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white m-0">
            Medicamentos
          </h1>
        </div>

        <NotificationBell />
      </header>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-neutral-400 font-medium m-0">
          Control de dosis diarias para hoy
        </p>
        <span className="px-3 py-1 rounded-full bg-[#1a1a1a] border border-neutral-800 text-[11px] font-bold text-neutral-300">
          {completedDoses}/{totalDoses} tomadas
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedPerson('todos')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedPerson === 'todos'
              ? 'bg-[#F76911] text-white shadow-[0_4px_12px_rgba(247,105,17,0.3)]'
              : 'bg-[#1a1a1a] text-neutral-400 border border-neutral-800/80 hover:text-white'
          }`}
        >
          Todos
        </button>

        {availableFilterPersons.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSelectedPerson(p)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedPerson.toLowerCase() === p.toLowerCase()
                ? 'bg-[#F76911] text-white shadow-[0_4px_12px_rgba(247,105,17,0.3)]'
                : 'bg-[#1a1a1a] text-neutral-400 border border-neutral-800/80 hover:text-white'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <main className="flex flex-col gap-3">
        {filteredDoses.length === 0 ? (
          <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
              <svg className="w-6 h-6 stroke-current fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-neutral-300 m-0">No hay dosis pendientes para hoy</p>
            <p className="text-xs text-neutral-500 mt-1">Presiona el botón + para programar un tratamiento.</p>
          </div>
        ) : (
          filteredDoses.map((dose) => (
            <article
              key={dose.key}
              className={`p-4 rounded-[24px] border transition-all flex items-center justify-between gap-3 ${
                dose.isTaken
                  ? 'bg-[#151515] border-neutral-800/50 opacity-60'
                  : 'bg-[#1a1a1a] border-neutral-800/80 shadow-md'
              }`}
            >
              <div
                onClick={() => openEditModal(dose.med)}
                className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex flex-col items-center justify-center shrink-0 font-bold text-xs ${
                    dose.isTaken
                      ? 'bg-neutral-800 text-neutral-500'
                      : 'bg-neutral-900 text-[#F76911] border border-neutral-800'
                  }`}
                >
                  <span className="leading-none">{dose.time}</span>
                  <span className="text-[9px] text-neutral-500 mt-0.5 font-normal">hrs</span>
                </div>

                <div className="truncate flex-1">
                  <h2 className={`text-sm font-bold leading-tight truncate m-0 ${dose.isTaken ? 'line-through text-neutral-400' : 'text-white'}`}>
                    {dose.name}
                  </h2>

                  <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {dose.dose && <span>{dose.dose}</span>}
                    {dose.dose && <span className="text-neutral-600">•</span>}
                    <span className="text-neutral-300 font-semibold">{dose.person}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-[10px] text-neutral-500">
                      {dose.endDate ? `Hasta ${dose.endDate}` : 'Permanente'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditModal(dose.med)}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                  title="Modificar recordatorio"
                >
                  <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  disabled={loadingAction === dose.key}
                  onClick={() => toggleDose(dose.medId, dose.time, dose.isTaken)}
                  style={dose.isTaken ? undefined : orangeGradient}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all ${
                    dose.isTaken
                      ? 'bg-neutral-800 text-neutral-400 hover:text-white'
                      : 'text-white shadow-[0_4px_12px_rgba(247,105,17,0.3)]'
                  }`}
                  title={dose.isTaken ? 'Marcar como pendiente' : 'Marcar como tomada'}
                >
                  {loadingAction === dose.key ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : dose.isTaken ? (
                    <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </button>
              </div>
            </article>
          ))
        )}
      </main>

      <button
        type="button"
        onClick={openCreateModal}
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(247,105,17,0.4)] active:scale-90 transition-transform cursor-pointer z-30"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-black text-white m-0">
                {editingId ? 'Editar recordatorio' : 'Nuevo medicamento'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMed} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Medicamento</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Paracetamol, Eutirox, Vitamina B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300">Dosis / Presentación</label>
                  <input
                    type="text"
                    placeholder="Ej. 500mg, 1 comprimido"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300">Hora de toma</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">¿Para quién es?</label>
                <div className="relative">
                  <select
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                  >
                    {members.map((member) => (
                      <option
                        key={member.id}
                        value={member.name}
                        className="bg-[#1a1a1a] text-white"
                      >
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-400">
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-neutral-300">Frecuencia / Recurrencia</label>
                <div className="relative">
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-400">
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {frequency === 'custom_days' && (
                  <div className="mt-1 p-3 bg-[#131313] border border-neutral-800 rounded-2xl flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-neutral-400">
                      Selecciona los días de la toma:
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = selectedDays.includes(day.id)
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            style={isSelected ? orangeGradient : undefined}
                            className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'text-white shadow-md'
                                : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/40'
                            }`}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-neutral-500 m-0">
                      {selectedDays.length === 0
                        ? 'Selecciona al menos un día'
                        : `Se recordará los: ${selectedDays
                            .map((id) => DAYS_OF_WEEK.find((d) => d.id === id)?.name)
                            .join(', ')}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300">¿Hasta cuándo tomar?</label>
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate('')}
                      className="text-[10px] text-[#F76911] font-bold hover:underline cursor-pointer"
                    >
                      Dejar indefinido
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
                <p className="text-[10px] text-neutral-500 m-0">
                  {endDate
                    ? `Finaliza el ${endDate}. Después de esa fecha no volverá a recordarse.`
                    : 'Sin fecha de fin: el recordatorio se mantendrá activo siempre.'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/2 py-3.5 rounded-2xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer hover:bg-neutral-700 transition-colors"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    style={orangeGradient}
                    className="w-1/2 py-3.5 rounded-2xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear recordatorio'}
                  </button>
                </div>

                {editingId && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteMed}
                    className="w-full py-2.5 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/40 font-bold text-xs cursor-pointer transition-colors mt-1"
                  >
                    {isDeleting ? 'Eliminando...' : 'Eliminar este recordatorio'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
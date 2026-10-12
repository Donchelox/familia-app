'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import PushSubscriptionManager from '@/components/PushSubscriptionManager'
import {
  addMedicationAction,
  updateMedicationAction,
  deleteMedicationAction,
  toggleDoseAction,
} from '@/app/actions/meds'

export interface Medication {
  id: string
  name: string
  dose: string | null
  times: string[] | null
  assigned_to: string | null
}

interface MedsClientViewProps {
  familyId: string
  meds: Medication[]
  takenKeys: string[]
  todayStr: string
  currentHM: string
}

export default function MedsClientView({
  familyId,
  meds,
  takenKeys,
  todayStr,
  currentHM,
}: MedsClientViewProps) {
  const router = useRouter()
  const [editingMed, setEditingMed] = useState<Medication | null>(null)
  const [isPending, startTransition] = useTransition()

  // Guardar copia local de las llaves de dosis tomadas para feedback visual inmediato
  const [localTaken, setLocalTaken] = useState<Set<string>>(new Set(takenKeys))

  // Sincronizar si cambian las props
  const takenSet = localTaken

  // Desglosar dosis
  const allDoses: Array<{
    medId: string
    name: string
    dose: string | null
    time: string
    assignedTo: string | null
    isTaken: boolean
    originalMed: Medication
  }> = []

  meds.forEach((med) => {
    let tList: string[] = []
    if (Array.isArray(med.times) && med.times.length > 0) {
      tList = med.times
    } else if (typeof med.times === 'string' && (med.times as string).trim().length > 0) {
      tList = (med.times as string).split(',').map((s) => s.trim())
    } else {
      tList = ['08:00']
    }

    tList.forEach((t) => {
      const isTaken = takenSet.has(`${med.id}_${t}`) || takenSet.has(`${med.id}_`)
      allDoses.push({
        medId: med.id,
        name: med.name,
        dose: med.dose,
        time: t,
        assignedTo: med.assigned_to || 'Todos',
        isTaken,
        originalMed: med,
      })
    })
  })

  allDoses.sort((a, b) => a.time.localeCompare(b.time))

  const pendingDoses = allDoses.filter((d) => !d.isTaken)
  const nextDose = pendingDoses.find((d) => d.time >= currentHM) || pendingDoses[0]

  async function handleToggle(fd: FormData, medId: string, time: string, currentTaken: boolean) {
    const key = `${medId}_${time}`
    // Cambio optimista instantáneo
    setLocalTaken((prev) => {
      const next = new Set(prev)
      if (currentTaken) {
        next.delete(key)
        next.delete(`${medId}_`)
      } else {
        next.add(key)
      }
      return next
    })

    startTransition(async () => {
      await toggleDoseAction(fd)
      router.refresh()
    })
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
          Medicamentos
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
          Dosis de hoy ({allDoses.length} programadas)
        </p>
      </header>

      <PushSubscriptionManager familyId={familyId} />

      {/* Lista de hoy */}
      <section
        style={{
          backgroundColor: '#131d2a',
          borderRadius: '16px',
          padding: '1.25rem',
          marginBottom: '2rem',
          border: '1px solid #1e293b',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1rem', color: '#f8fafc' }}>
          Hoy
        </h2>

        {allDoses.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
            No hay medicamentos programados.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {allDoses.map((doseItem, idx) => {
              const isNext =
                nextDose &&
                nextDose.medId === doseItem.medId &&
                nextDose.time === doseItem.time &&
                !doseItem.isTaken

              return (
                <div
                  key={`${doseItem.medId}_${doseItem.time}_${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: doseItem.isTaken ? '#0f172280' : '#1e293b50',
                    border: '1px solid',
                    borderColor: isNext ? '#CDF6F9' : '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <form
                      action={(fd) =>
                        handleToggle(fd, doseItem.medId, doseItem.time, doseItem.isTaken)
                      }
                    >
                      <input type="hidden" name="medicationId" value={doseItem.medId} />
                      <input type="hidden" name="date" value={todayStr} />
                      <input type="hidden" name="scheduledTime" value={doseItem.time} />
                      <input type="hidden" name="isTaken" value={doseItem.isTaken ? 'true' : 'false'} />
                      <button
                        type="submit"
                        disabled={isPending}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: doseItem.isTaken ? '#3b82f6' : 'transparent',
                          border: doseItem.isTaken ? 'none' : '2px solid #64748b',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {doseItem.isTaken ? '✓' : ''}
                      </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          color: doseItem.isTaken ? '#64748b' : '#f8fafc',
                        }}
                      >
                        {doseItem.time}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: doseItem.isTaken ? '#64748b' : '#f1f5f9',
                            textDecoration: doseItem.isTaken ? 'line-through' : 'none',
                          }}
                        >
                          {doseItem.name} {doseItem.dose ? `· ${doseItem.dose}` : ''}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {doseItem.assignedTo}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isNext && (
                      <span
                        style={{
                          padding: '0.2rem 0.55rem',
                          borderRadius: '20px',
                          backgroundColor: '#CDF6F920',
                          color: '#CDF6F9',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          border: '1px solid #CDF6F940',
                        }}
                      >
                        Próxima
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setEditingMed(doseItem.originalMed)}
                      title="Modificar medicina"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '0.3rem',
                        fontSize: '0.9rem',
                        borderRadius: '6px',
                      }}
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Formulario Añadir */}
      <section
        style={{
          backgroundColor: '#131d2a',
          borderRadius: '16px',
          padding: '1.25rem',
          border: '1px solid #1e293b',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.25rem', color: '#f8fafc' }}>
          Añadir medicamento
        </h2>

        <form
          action={async (fd) => {
            startTransition(async () => {
              await addMedicationAction(fd)
              router.refresh()
            })
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Para quién
            </label>
            <input
              type="text"
              name="assignedTo"
              placeholder="Ej: Marcelo"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: '#0f1722',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Medicamento
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Ej: Paracetamol"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: '#0f1722',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Dosis
            </label>
            <input
              type="text"
              name="dose"
              placeholder="Ej: 1 comprimido"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: '#0f1722',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Horas (separadas por coma)
            </label>
            <input
              type="text"
              name="times"
              required
              placeholder="Ej: 08:00, 14:00, 20:00"
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: '#0f1722',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              borderRadius: '10px',
              backgroundColor: '#CDF6F9',
              color: '#0f1722',
              fontWeight: 700,
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isPending ? 'Guardando...' : 'Guardar medicamento'}
          </button>
        </form>
      </section>

      {/* Modal para Modificar o Eliminar */}
      {editingMed && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#000000aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 50,
          }}
        >
          <div
            style={{
              backgroundColor: '#131d2a',
              borderRadius: '16px',
              padding: '1.5rem',
              maxWidth: '450px',
              width: '100%',
              border: '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>Modificar medicina</h3>
              <button
                type="button"
                onClick={() => setEditingMed(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form
              action={async (fd) => {
                startTransition(async () => {
                  await updateMedicationAction(fd)
                  setEditingMed(null)
                  router.refresh()
                })
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
            >
              <input type="hidden" name="id" value={editingMed.id} />

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Para quién
                </label>
                <input
                  type="text"
                  name="assignedTo"
                  defaultValue={editingMed.assigned_to || ''}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: '#0f1722',
                    border: '1px solid #334155',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingMed.name}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: '#0f1722',
                    border: '1px solid #334155',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Dosis
                </label>
                <input
                  type="text"
                  name="dose"
                  defaultValue={editingMed.dose || ''}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: '#0f1722',
                    border: '1px solid #334155',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Horas (separadas por coma)
                </label>
                <input
                  type="text"
                  name="times"
                  required
                  defaultValue={Array.isArray(editingMed.times) ? editingMed.times.join(', ') : (editingMed.times || '')}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: '#0f1722',
                    border: '1px solid #334155',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={isPending}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#CDF6F9',
                    color: '#0f1722',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>

            <form
              action={async (fd) => {
                if (confirm(`¿Seguro que deseas eliminar "${editingMed.name}"?`)) {
                  startTransition(async () => {
                    await deleteMedicationAction(fd)
                    setEditingMed(null)
                    router.refresh()
                  })
                }
              }}
              style={{ marginTop: '0.75rem' }}
            >
              <input type="hidden" name="id" value={editingMed.id} />
              <button
                type="submit"
                disabled={isPending}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  backgroundColor: '#7f1d1d30',
                  color: '#f87171',
                  border: '1px solid #7f1d1d80',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Eliminar medicina
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
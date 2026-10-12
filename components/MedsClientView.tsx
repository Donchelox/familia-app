'use client'

import { useState, useEffect, useTransition } from 'react'
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
  person: string | null
}

export interface Member {
  id: string
  name: string
}

interface MedsClientViewProps {
  familyId: string
  meds: Medication[]
  members: Member[]
  takenKeys: string[]
  todayStr: string
  currentHM: string
}

const ALL_FAMILY = 'Toda la familia'

export default function MedsClientView({
  familyId,
  meds,
  members,
  takenKeys,
  todayStr,
  currentHM,
}: MedsClientViewProps) {
  const router = useRouter()
  const [editingMed, setEditingMed] = useState<Medication | null>(null)
  const [isPending, startTransition] = useTransition()

  // Estados locales
  const [medsList, setMedsList] = useState<Medication[]>(meds)
  const [localTaken, setLocalTaken] = useState<Set<string>>(new Set(takenKeys))

  // Lista dinámica de horas para el formulario de añadir
  const [addTimes, setAddTimes] = useState<string[]>(['08:00'])

  // Lista dinámica de horas para el modal de edición
  const [editTimes, setEditTimes] = useState<string[]>(['08:00'])

  useEffect(() => {
    setMedsList(meds)
  }, [meds])

  useEffect(() => {
    setLocalTaken(new Set(takenKeys))
  }, [takenKeys])

  // Cargar horas al abrir el modal de edición
  useEffect(() => {
    if (editingMed) {
      if (Array.isArray(editingMed.times) && editingMed.times.length > 0) {
        setEditTimes(editingMed.times)
      } else {
        setEditTimes(['08:00'])
      }
    }
  }, [editingMed])

  const takenSet = localTaken

  // Desglosar dosis diarias
  const allDoses: Array<{
    medId: string
    name: string
    dose: string | null
    time: string
    assignedTo: string
    isTaken: boolean
    originalMed: Medication
  }> = []

  medsList.forEach((med) => {
    const tList = Array.isArray(med.times) && med.times.length > 0 ? med.times : ['08:00']
    tList.forEach((t) => {
      allDoses.push({
        medId: med.id,
        name: med.name,
        dose: med.dose,
        time: t,
        assignedTo: med.person || ALL_FAMILY,
        isTaken: takenSet.has(`${med.id}_${t}`),
        originalMed: med,
      })
    })
  })

  allDoses.sort((a, b) => a.time.localeCompare(b.time))

  const pendingDoses = allDoses.filter((d) => !d.isTaken)
  const nextDose = pendingDoses.find((d) => d.time >= currentHM) || pendingDoses[0]

  async function handleToggle(fd: FormData, medId: string, time: string, currentTaken: boolean) {
    const key = `${medId}_${time}`
    setLocalTaken((prev) => {
      const next = new Set(prev)
      if (currentTaken) next.delete(key)
      else next.add(key)
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

      {/* Tarjeta: Hoy */}
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

      {/* Formulario Añadir Medicamento */}
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
              setAddTimes(['08:00'])
              router.refresh()
            })
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {/* Desplegable de Miembros */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Para quién
            </label>
            <select
              name="person"
              defaultValue={ALL_FAMILY}
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
            >
              <option value={ALL_FAMILY}>Toda la familia (sin asignar)</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Medicamento
            </label>
            <input
              type="text"
              name="name"
              required
              maxLength={200}
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
              maxLength={200}
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

          {/* Selector de Horas con Input Time */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
              Horarios de toma
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {addTimes.map((tVal, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="time"
                    name="times"
                    required
                    value={tVal}
                    onChange={(e) => {
                      const updated = [...addTimes]
                      updated[idx] = e.target.value
                      setAddTimes(updated)
                    }}
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#0f1722',
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                  {addTimes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAddTimes(addTimes.filter((_, i) => i !== idx))}
                      style={{
                        padding: '0.55rem 0.8rem',
                        backgroundColor: '#7f1d1d20',
                        color: '#f87171',
                        border: '1px solid #7f1d1d60',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAddTimes([...addTimes, '12:00'])}
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.4rem 0.75rem',
                  backgroundColor: '#1e293b',
                  color: '#CDF6F9',
                  border: '1px dashed #38bdf860',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  marginTop: '0.2rem',
                }}
              >
                + Añadir otra hora
              </button>
            </div>
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
                const updatedTimes = editTimes.filter(Boolean)
                const updatedName = String(fd.get('name') || '').trim()
                const updatedDose = String(fd.get('dose') || '').trim()
                const updatedPerson = String(fd.get('person') || '').trim() || ALL_FAMILY

                setMedsList((prev) =>
                  prev.map((m) =>
                    m.id === editingMed.id
                      ? {
                          ...m,
                          name: updatedName,
                          dose: updatedDose || null,
                          times: updatedTimes,
                          person: updatedPerson,
                        }
                      : m
                  )
                )

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
                <select
                  name="person"
                  defaultValue={editingMed.person || ALL_FAMILY}
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    borderRadius: '8px',
                    backgroundColor: '#0f1722',
                    border: '1px solid #334155',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value={ALL_FAMILY}>Toda la familia (sin asignar)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Nombre
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  maxLength={200}
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
                  maxLength={200}
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

              {/* Selector de Horas en Edición con Input Time */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Horarios de toma
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {editTimes.map((tVal, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="time"
                        name="times"
                        required
                        value={tVal}
                        onChange={(e) => {
                          const updated = [...editTimes]
                          updated[idx] = e.target.value
                          setEditTimes(updated)
                        }}
                        style={{
                          flex: 1,
                          padding: '0.55rem 0.65rem',
                          borderRadius: '8px',
                          backgroundColor: '#0f1722',
                          border: '1px solid #334155',
                          color: '#fff',
                          boxSizing: 'border-box',
                        }}
                      />
                      {editTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditTimes(editTimes.filter((_, i) => i !== idx))}
                          style={{
                            padding: '0.45rem 0.7rem',
                            backgroundColor: '#7f1d1d20',
                            color: '#f87171',
                            border: '1px solid #7f1d1d60',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEditTimes([...editTimes, '12:00'])}
                    style={{
                      alignSelf: 'flex-start',
                      padding: '0.35rem 0.65rem',
                      backgroundColor: '#1e293b',
                      color: '#CDF6F9',
                      border: '1px dashed #38bdf860',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      marginTop: '0.2rem',
                    }}
                  >
                    + Añadir otra hora
                  </button>
                </div>
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
                  setMedsList((prev) => prev.filter((m) => m.id !== editingMed.id))
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
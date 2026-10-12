import { getContext } from '@/lib/family'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PushSubscriptionManager from '@/components/PushSubscriptionManager'
import { addMedication, toggleDose } from '@/app/actions/meds'

export const dynamic = 'force-dynamic'

interface Medication {
  id: string
  name: string
  dose: string | null
  times: string[]
  assigned_to: string | null
}

export default async function MedsPage() {
  const ctx = await getContext()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // 1. Obtener medicamentos de la familia
  const { data: medsData } = await supabase
    .from('medications')
    .select('id, name, dose, times, assigned_to')
    .eq('family_id', ctx.familyId)

  const meds: Medication[] = (medsData as Medication[]) || []

  // 2. Fecha de hoy en formato YYYY-MM-DD (Chile)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
  }).format(new Date())

  // 3. Consultar dosis tomadas hoy
  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('medication_id, scheduled_time')
    .eq('family_id', ctx.familyId)
    .eq('date', todayStr)

  // Conjunto de dosis tomadas: "medId_hora"
  const takenSet = new Set(
    (doseLogs || []).map((d) => `${d.medication_id}_${d.scheduled_time}`)
  )

  // 4. Aplanar la lista de dosis del día según las horas programadas
  interface ScheduledDose {
    medId: string
    name: string
    dose: string | null
    time: string
    assignedTo: string | null
    isTaken: boolean
  }

  const allDoses: ScheduledDose[] = []
  meds.forEach((med) => {
    const times = Array.isArray(med.times) && med.times.length > 0 ? med.times : ['08:00']
    times.forEach((t) => {
      allDoses.push({
        medId: med.id,
        name: med.name,
        dose: med.dose,
        time: t,
        assignedTo: med.assigned_to,
        isTaken: takenSet.has(`${med.id}_${t}`),
      })
    })
  })

  // Ordenar cronológicamente por hora (ej: 08:00 antes de 14:00)
  allDoses.sort((a, b) => a.time.localeCompare(b.time))

  // Hora actual en Chile (HH:MM)
  const currentHM = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())

  const pendingDoses = allDoses.filter((d) => !d.isTaken)
  const nextDose = pendingDoses.find((d) => d.time >= currentHM) || pendingDoses[0]

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
          Medicamentos
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>
          Dosis de hoy
        </p>
      </header>

      {/* Botón para registrar dispositivo en Web Push */}
      <PushSubscriptionManager familyId={ctx.familyId} />

      {/* Lista de dosis programadas para hoy */}
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
              const isNext = nextDose && nextDose.medId === doseItem.medId && nextDose.time === doseItem.time && !doseItem.isTaken

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
                    <form action={toggleDose}>
                      <input type="hidden" name="medicationId" value={doseItem.medId} />
                      <input type="hidden" name="date" value={todayStr} />
                      <input type="hidden" name="scheduledTime" value={doseItem.time} />
                      <button
                        type="submit"
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
                          {doseItem.assignedTo || 'Todos'}
                        </div>
                      </div>
                    </div>
                  </div>

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
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Formulario para añadir medicamento */}
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

        <form action={addMedication} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            {/* ⚠️ El name debe ser 'times' para que coincida con app/actions/meds.ts */}
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
            Guardar medicamento
          </button>
        </form>
      </section>
    </div>
  )
}
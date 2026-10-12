import { getContext } from '@/lib/family'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import PushSubscriptionManager from '@/components/PushSubscriptionManager'
import { addMedication, toggleDose } from '@/app/actions/meds'

export const dynamic = 'force-dynamic'

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

  // Obtener lista de medicamentos de la familia
  const { data: meds } = await supabase
    .from('medications')
    .select('*')
    .eq('family_id', ctx.familyId)
    .order('schedule_time', { ascending: true })

  // Obtener fecha de hoy en formato YYYY-MM-DD (Chile)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
  }).format(new Date())

  // Obtener dosis registradas hoy
  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('medication_id')
    .eq('family_id', ctx.familyId)
    .eq('taken_date', todayStr)

  const takenIds = new Set((doseLogs || []).map((d) => d.medication_id))

  // Hora actual para determinar cuál es la "Próxima"
  const currentHM = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())

  const pendingMeds = (meds || []).filter((m) => !takenIds.has(m.id))
  const nextMed = pendingMeds.find((m) => m.schedule_time >= currentHM) || pendingMeds[0]

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

      {/* Botón para solicitar y activar las notificaciones Push nativas */}
      <PushSubscriptionManager familyId={ctx.familyId} />

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

        {(!meds || meds.length === 0) ? (
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
            No hay medicamentos programados.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {meds.map((med) => {
              const isTaken = takenIds.has(med.id)
              const isNext = nextMed && nextMed.id === med.id && !isTaken

              return (
                <div
                  key={med.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: isTaken ? '#0f172280' : '#1e293b50',
                    border: '1px solid',
                    borderColor: isNext ? '#CDF6F9' : '#334155',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* Form para marcar/desmarcar dosis */}
                    <form action={toggleDose}>
                      <input type="hidden" name="medId" value={med.id} />
                      <input type="hidden" name="familyId" value={ctx.familyId} />
                      <input type="hidden" name="date" value={todayStr} />
                      <input type="hidden" name="isTaken" value={isTaken ? 'true' : 'false'} />
                      <button
                        type="submit"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: isTaken ? '#3b82f6' : 'transparent',
                          border: isTaken ? 'none' : '2px solid #64748b',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        {isTaken ? '✓' : ''}
                      </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          color: isTaken ? '#64748b' : '#f8fafc',
                        }}
                      >
                        {med.schedule_time || '--:--'}
                      </span>
                      <div>
                        <div
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            color: isTaken ? '#64748b' : '#f1f5f9',
                            textDecoration: isTaken ? 'line-through' : 'none',
                          }}
                        >
                          {med.name} {med.dose ? `· ${med.dose}` : ''}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {med.assigned_to || ctx.familyName}
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

      {/* Formulario: Añadir medicamento */}
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
          <input type="hidden" name="familyId" value={ctx.familyId} />

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
              Horas (separadas por coma o formato HH:MM)
            </label>
            <input
              type="text"
              name="scheduleTime"
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
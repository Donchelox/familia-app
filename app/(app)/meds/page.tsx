import { getContext } from '@/lib/family'
import { todayStr, nowHHMM } from '@/lib/dates'
import { addMedication, deleteMedication, toggleDose } from '@/app/actions/meds'
import { setReminders } from '@/app/actions/family'

export default async function Meds() {
  const { supabase, familyId, role, reminderEmail, reminderPush } = await getContext()
  const canEdit = role !== 'viewer'
  const today = todayStr(), now = nowHHMM()
  const [m, l, p] = await Promise.all([
    supabase.from('medications').select('id, person, name, dose, times').eq('family_id', familyId).order('created_at'),
    supabase.from('dose_logs').select('medication_id, time').eq('family_id', familyId).eq('day', today),
    supabase.from('members').select('display_name, email').eq('family_id', familyId),
  ])
  const meds = m.data ?? []
  const taken = new Set((l.data ?? []).map((x) => `${x.medication_id}|${x.time}`))
  const doses = meds.flatMap((x) => x.times.map((t: string) => ({ m: x, t }))).sort((a, b) => a.t.localeCompare(b.t))
  const next = doses.find((d) => !taken.has(`${d.m.id}|${d.t}`) && d.t >= now)

  return (
    <>
      <div className="page-h"><h1>Medicamentos</h1><p className="muted">Dosis de hoy</p></div>
      <div className="panel">
        <h2>Hoy</h2>
        {doses.length ? (
          <ul className="items">
            {doses.map((d) => {
              const tk = taken.has(`${d.m.id}|${d.t}`)
              const late = !tk && d.t < now
              return (
                <li key={`${d.m.id}|${d.t}`} className={tk ? 'done' : ''}>
                  <form action={toggleDose}>
                    <input type="hidden" name="id" value={d.m.id} />
                    <input type="hidden" name="time" value={d.t} />
                    <button className="check" aria-pressed={tk} disabled={!canEdit}
                      aria-label={`${tk ? 'Desmarcar' : 'Marcar como tomada'}: ${d.m.name} ${d.t}`}>{tk ? '✓' : ''}</button>
                  </form>
                  <span className="time">{d.t}</span>
                  <span className="t">{d.m.name} <span className="muted">· {d.m.dose} · {d.m.person}</span></span>
                  {late && <span className="tag warn">Atrasada</span>}
                  {next && next.m.id === d.m.id && next.t === d.t && <span className="tag next">Próxima</span>}
                </li>
              )
            })}
          </ul>
        ) : <p className="muted">No hay medicamentos programados. Añade el primero.</p>}
      </div>

      {canEdit && (
        <div className="panel">
          <h2>Añadir medicamento</h2>
          <form action={addMedication} className="stack" style={{ marginTop: 0 }}>
            <datalist id="people">{(p.data ?? []).map((x, i) => <option key={i} value={x.display_name || x.email} />)}</datalist>
            <div className="grid2">
              <div><label htmlFor="m-who">Para quién</label><input id="m-who" name="person" list="people" required /></div>
              <div><label htmlFor="m-name">Medicamento</label><input id="m-name" name="name" required /></div>
              <div><label htmlFor="m-dose">Dosis</label><input id="m-dose" name="dose" placeholder="1 comprimido" required /></div>
              <div>
                <label htmlFor="m-times">Horas (separadas por coma)</label>
                <input id="m-times" name="times" placeholder="08:00, 20:00" required
                  pattern="\s*([01]?\d|2[0-3]):[0-5]\d(\s*,\s*([01]?\d|2[0-3]):[0-5]\d)*\s*" title="Formato 08:00, 20:00" />
              </div>
            </div>
            <div><button className="btn">Añadir medicamento</button></div>
          </form>
        </div>
      )}

      <div className="panel">
        <h2>Tratamientos</h2>
        {meds.length ? (
          <ul className="items">
            {meds.map((x) => (
              <li key={x.id}>
                <span className="t"><strong>{x.name}</strong> <span className="muted">· {x.dose} · {x.person}<br />{x.times.join(' · ')}</span></span>
                {canEdit && (
                  <form action={deleteMedication}>
                    <input type="hidden" name="id" value={x.id} />
                    <button className="btn danger">Eliminar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted">Aún no hay tratamientos.</p>}
      </div>

      <div className="panel">
        <h2>Recordatorios</h2>
        <p className="muted" style={{ marginBottom: 10 }}>Se envían a la hora de cada dosis.</p>
        <form action={setReminders}>
          <label className="chk"><input type="checkbox" name="email" defaultChecked={reminderEmail} disabled={role !== 'admin'} /> Por correo electrónico</label>
          <label className="chk"><input type="checkbox" name="push" defaultChecked={reminderPush} disabled={role !== 'admin'} /> Notificación push en el celular</label>
          {role === 'admin'
            ? <button className="btn ghost" style={{ marginTop: 6 }}>Guardar</button>
            : <p className="muted">Solo un administrador puede cambiarlo.</p>}
        </form>
      </div>
    </>
  )
}

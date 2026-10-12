import type { Ctx } from '@/lib/family'
import { addBlock, deleteBlock, saveSlots } from '@/app/actions/school'

const DN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default async function ScheduleAdmin({ ctx }: { ctx: Ctx }) {
  const { supabase, familyId } = ctx
  const [b, s] = await Promise.all([
    supabase.from('school_blocks').select('id, day, start_block, length, subject').eq('family_id', familyId).order('start_block'),
    supabase.from('school_slots').select('block, starts_at').eq('family_id', familyId),
  ])
  const blocks = b.data ?? []
  const slots: Record<number, string> = Object.fromEntries((s.data ?? []).map((x) => [x.block, String(x.starts_at).slice(0, 5)]))
  const maxP = Math.max(8, ...blocks.map((x) => x.start_block + x.length - 1))
  const subjects = [...new Set(blocks.map((x) => x.subject))]

  return (
    <section className="panel" aria-labelledby="p-hor">
      <h2 id="p-hor">Horario de clases</h2>
      <p className="muted" style={{ marginBottom: 8 }}>
        Se muestra en Colegio solo para consulta. Cada número es un bloque de la jornada; las clases dobles ocupan dos.
      </p>
      <datalist id="subjects">{subjects.map((x) => <option key={x} value={x} />)}</datalist>
      {DN.map((n, i) => {
        const es = blocks.filter((x) => x.day === i + 1)
        return (
          <div key={n}>
            <h3 className="sh3">{n}</h3>
            {es.length ? (
              <ul className="items">
                {es.map((x) => (
                  <li key={x.id}>
                    <span className="time">{x.start_block}{x.length > 1 ? `–${x.start_block + x.length - 1}` : ''}</span>
                    <span className="t">{x.subject}</span>
                    <form action={deleteBlock}>
                      <input type="hidden" name="id" value={x.id} />
                      <button className="btn danger" aria-label={`Eliminar ${x.subject} del ${n}`}>Eliminar</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">Sin clases</p>}
          </div>
        )
      })}
      <details className="hist">
        <summary>Añadir clase</summary>
        <form action={addBlock} className="stack">
          <div className="grid2">
            <div>
              <label htmlFor="b-day">Día</label>
              <select id="b-day" name="day">{DN.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</select>
            </div>
            <div>
              <label htmlFor="b-start">Bloque inicial</label>
              <input id="b-start" name="start" type="number" min={1} max={12} required />
            </div>
          </div>
          <div className="grid2">
            <div>
              <label htmlFor="b-len">Duración</label>
              <select id="b-len" name="length"><option value="1">1 bloque</option><option value="2">2 bloques</option></select>
            </div>
            <div>
              <label htmlFor="b-sub">Asignatura</label>
              <input id="b-sub" name="subject" list="subjects" required />
            </div>
          </div>
          <div><button className="btn">Añadir clase</button></div>
        </form>
      </details>
      <details className="hist">
        <summary>Horas de cada bloque (opcional)</summary>
        <form action={saveSlots} className="stack">
          <div className="grid2">
            {Array.from({ length: maxP }, (_, i) => (
              <div key={i}>
                <label htmlFor={`slot_${i + 1}`}>Bloque {i + 1}</label>
                <input id={`slot_${i + 1}`} name={`slot_${i + 1}`} type="time" defaultValue={slots[i + 1] ?? ''} />
              </div>
            ))}
          </div>
          <div><button className="btn">Guardar horas</button></div>
        </form>
      </details>
    </section>
  )
}

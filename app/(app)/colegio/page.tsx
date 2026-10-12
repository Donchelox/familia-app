import { getContext } from '@/lib/family'
import { todayStr, weekday, rel, fmtDate, diffDays } from '@/lib/dates'
import HistoryBox from '@/components/HistoryBox'
import { addTest, deleteTest, addHomework, toggleHomework, deleteHomework, clearHomework } from '@/app/actions/school'

const DN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

export default async function Colegio() {
  const { supabase, familyId, role } = await getContext()
  const ce = role !== 'viewer', today = todayStr(), wd = weekday()
  const [b, s, t, h] = await Promise.all([
    supabase.from('school_blocks').select('id, day, start_block, length, subject').eq('family_id', familyId).order('start_block'),
    supabase.from('school_slots').select('block, starts_at').eq('family_id', familyId),
    supabase.from('school_tests').select('id, subject, topic, test_date').eq('family_id', familyId).gte('test_date', today).order('test_date'),
    supabase.from('school_homework').select('id, subject, task, due, done').eq('family_id', familyId).order('due'),
  ])
  const blocks = b.data ?? [], tests = t.data ?? [], hw = h.data ?? []
  const slots: Record<number, string> = Object.fromEntries((s.data ?? []).map((x) => [x.block, String(x.starts_at).slice(0, 5)]))
  const label = (x: any) => slots[x.start_block] ?? `${x.start_block}${x.length > 1 ? `–${x.start_block + x.length - 1}` : ''}`
  const subjects = [...new Set(blocks.map((x) => x.subject))]
  const open = hw.filter((x) => !x.done), done = hw.filter((x) => x.done)
  const tag = (d: string) => (
    <span className={`tag${diffDays(d) < 0 ? ' warn' : diffDays(d) <= 2 ? ' next' : ''}`}>
      {diffDays(d) < 0 ? 'Atrasada · ' : ''}{rel(d)}
    </span>
  )

  return (
    <>
      <div className="page-h"><h1>Colegio</h1><p className="muted">Horario, pruebas y tareas</p></div>
      <datalist id="subj">{subjects.map((x) => <option key={x} value={x} />)}</datalist>

      <section className="panel">
        <h2>Horario de clases</h2>
        <div className="days">
          {DN.map((n, i) => (
            <div key={n} className={`day${wd === i + 1 ? ' today' : ''}`}>
              <h3>{n}{wd === i + 1 && <span className="tag next">Hoy</span>}</h3>
              {blocks.filter((x) => x.day === i + 1).map((x) => (
                <div className="cls" key={x.id}><span className="time">{label(x)}</span><span className="t">{x.subject}</span></div>
              ))}
              {!blocks.some((x) => x.day === i + 1) && <p className="muted">Sin clases</p>}
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: '.9rem' }}>
          {Object.keys(slots).length ? '' : 'Los números indican el bloque de la jornada. '}El horario se modifica en Ajustes (administradores).
        </p>
      </section>

      <section className="panel">
        <h2>Próximas pruebas</h2>
        {tests.length ? (
          <ul className="items">
            {tests.map((x) => (
              <li key={x.id}>
                <span className="time" style={{ minWidth: '6em' }}>{fmtDate(x.test_date)}</span>
                <span className="t"><strong>{x.subject}</strong>{x.topic && <span className="muted"> · {x.topic}</span>}</span>
                <span className={`tag${diffDays(x.test_date) <= 2 ? ' warn' : ''}`}>{rel(x.test_date)}</span>
                {ce && <form action={deleteTest}><input type="hidden" name="id" value={x.id} /><button className="btn danger">Eliminar</button></form>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No hay pruebas próximas.</p>}
        {ce && (
          <details className="hist">
            <summary>Añadir prueba</summary>
            <form action={addTest} className="stack">
              <div className="grid2">
                <div><label htmlFor="t-s">Asignatura</label><input id="t-s" name="subject" list="subj" required /></div>
                <div><label htmlFor="t-d">Fecha</label><input id="t-d" name="date" type="date" min={today} required /></div>
              </div>
              <div><label htmlFor="t-t">Materia a evaluar (opcional)</label><input id="t-t" name="topic" /></div>
              <div><button className="btn">Añadir prueba</button></div>
            </form>
          </details>
        )}
      </section>

      <section className="panel">
        <h2>Tareas y trabajos</h2>
        {open.length ? (
          <ul className="items">
            {open.map((x) => (
              <li key={x.id}>
                <form action={toggleHomework}>
                  <input type="hidden" name="id" value={x.id} />
                  <button className="check" aria-pressed="false" disabled={!ce} aria-label={`Marcar como hecha: ${x.task}`} />
                </form>
                <span className="t"><strong>{x.subject}</strong> <span className="muted">· {x.task}</span></span>
                {tag(x.due)}
                {ce && <form action={deleteHomework}><input type="hidden" name="id" value={x.id} /><button className="btn danger">Eliminar</button></form>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No hay tareas del colegio.</p>}
        <HistoryBox title="Hechas" rows={done.map((x) => ({ id: x.id, label: `${x.subject} · ${x.task}` }))}
          canEdit={ce} restore={toggleHomework} clear={clearHomework} />
        {ce && (
          <details className="hist">
            <summary>Añadir tarea</summary>
            <form action={addHomework} className="stack">
              <div className="grid2">
                <div><label htmlFor="h-s">Asignatura</label><input id="h-s" name="subject" list="subj" required /></div>
                <div><label htmlFor="h-d">Para el día</label><input id="h-d" name="due" type="date" required /></div>
              </div>
              <div><label htmlFor="h-t">Qué hay que hacer</label><input id="h-t" name="task" required /></div>
              <div><button className="btn">Añadir tarea</button></div>
            </form>
          </details>
        )}
      </section>
    </>
  )
}

import type { Ctx } from '@/lib/family'
import { fmtDateTime } from '@/lib/dates'
import { clearLog } from '@/app/actions/family'

export default async function LogPanel({ ctx }: { ctx: Ctx }) {
  const { supabase, familyId } = ctx
  const [{ count }, { data: rows }] = await Promise.all([
    supabase.from('activity_log').select('id', { count: 'exact', head: true }).eq('family_id', familyId),
    supabase.from('activity_log').select('id, created_at, user_name, module, action, item')
      .eq('family_id', familyId).order('created_at', { ascending: false }).limit(8),
  ])
  return (
    <section className="panel" aria-labelledby="p-log">
      <h2 id="p-log">Registro de actividad</h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        Guarda cada cambio en súper, feria, tareas y colegio, con fecha y hora. Los medicamentos no se registran.
        Sirve para pedirle a una IA que detecte patrones.
      </p>
      <p className="muted">{count ?? 0} registros · últimos movimientos:</p>
      <ul className="items" style={{ fontSize: '.9rem' }}>
        {rows?.map((e) => (
          <li key={e.id}>
            <span className="muted" style={{ minWidth: '8.5em' }}>{fmtDateTime(e.created_at)}</span>
            <span className="t">{e.module} · {e.action}{e.item ? `: ${e.item}` : ''}</span>
          </li>
        ))}
        {!rows?.length && <li className="muted">Aún no hay registros.</li>}
      </ul>
      <div className="inline">
        <a className="btn" href="/api/log.csv" download>Descargar CSV</a>
        <form action={clearLog}><button className="btn danger">Vaciar registro</button></form>
      </div>
    </section>
  )
}

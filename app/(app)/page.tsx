import Link from 'next/link'
import { getContext } from '@/lib/family'
import { todayStr, nowHHMM, rel } from '@/lib/dates'

export default async function Inicio() {
  const { supabase, familyId, familyName } = await getContext()
  const today = todayStr(), now = nowHHMM()
  const [shop, todos, tests, hw, meds, logs] = await Promise.all([
    supabase.from('shopping_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('done', false),
    supabase.from('todos').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('done', false),
    supabase.from('school_tests').select('subject, test_date').eq('family_id', familyId).gte('test_date', today).order('test_date'),
    supabase.from('school_homework').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('done', false),
    supabase.from('medications').select('id, name, person, times').eq('family_id', familyId),
    supabase.from('dose_logs').select('medication_id, time').eq('family_id', familyId).eq('day', today),
  ])
  const taken = new Set((logs.data ?? []).map((l) => `${l.medication_id}|${l.time}`))
  const pending = (meds.data ?? [])
    .flatMap((m) => m.times.map((t: string) => ({ m, t })))
    .filter((d) => !taken.has(`${d.m.id}|${d.t}`))
    .sort((a, b) => a.t.localeCompare(b.t))
  const nextDose = pending.find((d) => d.t >= now) ?? pending[0]
  const nextTest = tests.data?.[0]

  return (
    <>
      <div className="page-h">
        <h1>{familyName}</h1>
        <p className="muted">Todo lo de la casa en un solo lugar.</p>
      </div>
      <div className="panel home" style={{ padding: 0, overflow: 'hidden' }}>
        <Link className="row" href="/meds">
          <div>
            <div className="name">Medicamentos</div>
            <div className="muted">
              {nextDose ? `Próxima dosis: ${nextDose.t} · ${nextDose.m.name} · ${nextDose.m.person}` : 'Sin dosis pendientes hoy'}
            </div>
          </div>
          <span className={`tag${pending.length ? ' next' : ''}`}>{pending.length} pendientes</span>
        </Link>
        <Link className="row" href="/super">
          <div><div className="name">Supermercado</div><div className="muted">Supermercado y feria</div></div>
          <span className="tag">{shop.count ?? 0} por comprar</span>
        </Link>
        <Link className="row" href="/colegio">
          <div>
            <div className="name">Colegio</div>
            <div className="muted">
              {nextTest ? `Próxima prueba: ${nextTest.subject} · ${rel(nextTest.test_date).toLowerCase()}` : 'Sin pruebas próximas'}
              {` · ${hw.count ?? 0} tareas pendientes`}
            </div>
          </div>
          <span className="tag">{tests.data?.length ?? 0} pruebas</span>
        </Link>
        <Link className="row" href="/tareas">
          <div><div className="name">Tareas</div><div className="muted">Pendientes de la casa</div></div>
          <span className="tag">{todos.count ?? 0} pendientes</span>
        </Link>
      </div>
    </>
  )
}

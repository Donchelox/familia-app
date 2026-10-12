import { getContext } from '@/lib/family'
import HistoryBox from '@/components/HistoryBox'
import { addTodo, toggleTodo, deleteTodo, clearTodos } from '@/app/actions/todos'

export default async function Tareas() {
  const { supabase, familyId, role } = await getContext()
  const canEdit = role !== 'viewer'
  const { data } = await supabase.from('todos').select('id, title, done')
    .eq('family_id', familyId).order('created_at', { ascending: false }).limit(300)
  const open = (data ?? []).filter((t) => !t.done)
  const done = (data ?? []).filter((t) => t.done)

  return (
    <>
      <div className="page-h"><h1>Tareas</h1><p className="muted">Pendientes de la casa</p></div>
      <div className="panel">
        {canEdit && (
          <form action={addTodo} className="add">
            <input name="title" placeholder="Nueva tarea" aria-label="Nueva tarea" required />
            <button className="btn">Añadir</button>
          </form>
        )}
        {open.length ? (
          <ul className="items">
            {open.map((t) => (
              <li key={t.id}>
                <form action={toggleTodo}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="check" aria-pressed="false" disabled={!canEdit} aria-label={`Marcar ${t.title}`} />
                </form>
                <span className="t">{t.title}</span>
                {canEdit && (
                  <form action={deleteTodo}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn danger">Eliminar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="muted">No hay tareas pendientes.</p>}
        <HistoryBox title="Completadas" rows={done.map((t) => ({ id: t.id, label: t.title }))}
          canEdit={canEdit} restore={toggleTodo} clear={clearTodos} />
      </div>
    </>
  )
}

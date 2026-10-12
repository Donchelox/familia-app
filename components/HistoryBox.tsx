type Row = { id: string; label: string }

/** Historial comprimido: lo completado queda aquí y se puede restaurar. */
export default function HistoryBox({ title, rows, canEdit, restore, clear, hidden = {} }: {
  title: string
  rows: Row[]
  canEdit: boolean
  restore: (fd: FormData) => void | Promise<void>
  clear: (fd: FormData) => void | Promise<void>
  hidden?: Record<string, string>
}) {
  if (!rows.length) return null
  const fields = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
  return (
    <details className="hist">
      <summary>Historial · {title} ({rows.length})</summary>
      <ul className="items small">
        {rows.map((r) => (
          <li key={r.id}>
            <span className="t">{r.label}</span>
            {canEdit && (
              <form action={restore}>
                <input type="hidden" name="id" value={r.id} />
                {fields}
                <button className="btn ghost sm" aria-label={`Volver a la lista: ${r.label}`}>Restaurar</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canEdit && <form action={clear}>{fields}<button className="btn danger sm">Vaciar historial</button></form>}
    </details>
  )
}

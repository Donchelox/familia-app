import Link from 'next/link'
import { getContext } from '@/lib/family'
import HistoryBox from '@/components/HistoryBox'
import { addItems, toggleItem, deleteItem, clearBought } from '@/app/actions/shopping'

export default async function Super({ searchParams }: { searchParams: Promise<{ lista?: string }> }) {
  const { supabase, familyId, role } = await getContext()
  const { lista } = await searchParams
  const list = lista === 'feria' ? 'feria' : 'super'
  const fe = list === 'feria'
  const canEdit = role !== 'viewer'
  const { data } = await supabase.from('shopping_items').select('id, name, done')
    .eq('family_id', familyId).eq('list', list).order('created_at', { ascending: false }).limit(300)
  const items = (data ?? []).filter((i) => !i.done)
  const bought = (data ?? []).filter((i) => i.done)

  return (
    <>
      <div className="page-h">
        <h1>{fe ? 'Feria' : 'Supermercado'}</h1>
        {fe && <p className="muted">Frutas y verduras</p>}
      </div>
      <div className="seg" role="tablist">
        <Link href="/super" className={fe ? '' : 'on'} role="tab" aria-selected={!fe}>Supermercado</Link>
        <Link href="/super?lista=feria" className={fe ? 'on' : ''} role="tab" aria-selected={fe}>Feria</Link>
      </div>
      <div className="panel">
        {canEdit && (
          <form action={addItems} className="add">
            <input type="hidden" name="list" value={list} />
            <input name="name" placeholder={fe ? 'Paltas, limones, lechuga…' : 'Leche, pan, detergente…'} aria-label="Productos a añadir" required />
            <button className="btn">Añadir</button>
          </form>
        )}
        {items.length ? (
          <ul className="items">
            {items.map((i) => (
              <li key={i.id}>
                <form action={toggleItem}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="check" aria-pressed="false" disabled={!canEdit} aria-label={`Marcar ${i.name}`} />
                </form>
                <span className="t">{i.name}</span>
                {canEdit && (
                  <form action={deleteItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn danger" aria-label={`Eliminar ${i.name}`}>Eliminar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{fe ? 'No falta nada de la feria.' : 'La lista está vacía. Añade lo que falta en casa.'}</p>
        )}
        <HistoryBox
          title={fe ? 'Comprados en la feria' : 'Comprados'}
          rows={bought.map((i) => ({ id: i.id, label: i.name }))}
          canEdit={canEdit} restore={toggleItem} clear={clearBought} hidden={{ list }}
        />
      </div>
    </>
  )
}

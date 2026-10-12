import Link from 'next/link'
import { getContext } from '@/lib/family'
import HistoryBox from '@/components/HistoryBox'
import AddShoppingSheet from '@/components/AddShoppingSheet'
import { toggleItem, deleteItem, clearBought } from '@/app/actions/shopping'

export default async function Super({
  searchParams,
}: {
  searchParams: Promise<{ lista?: string }>
}) {
  const { supabase, familyId, role } = await getContext()
  const { lista } = await searchParams
  const list = lista === 'feria' ? 'feria' : 'super'
  const fe = list === 'feria'
  const canEdit = role !== 'viewer'

  const { data } = await supabase
    .from('shopping_items')
    .select('id, name, done')
    .eq('family_id', familyId)
    .eq('list', list)
    .order('created_at', { ascending: false })
    .limit(300)

  const items = (data ?? []).filter((i) => !i.done)
  const bought = (data ?? []).filter((i) => i.done)

  return (
    <div className="w-full flex flex-col gap-6 relative min-h-[calc(100vh-80px)] pb-24">
      {/* 1. HEADER IDÉNTICO A FIGMA */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="text-[#F76911] hover:opacity-80 transition-opacity p-1 no-underline flex items-center justify-center"
          >
            <svg
              className="w-7 h-7 stroke-current stroke-[3] fill-none"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {fe ? 'Feria' : 'Compras'}
          </h1>
        </div>

        {/* Campana con dot naranja */}
        <Link
          href="/notificaciones"
          aria-label="Notificaciones"
          className="relative p-2 text-white hover:opacity-80 transition-opacity no-underline"
        >
          <svg className="w-6 h-6 stroke-white stroke-2 fill-none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F76911] rounded-full ring-2 ring-[#131313]" />
        </Link>
      </header>

      {/* 2. SELECTOR DE PESTAÑAS (SUPERMERCADO / FERIA) */}
      <div className="flex p-1 bg-[#1a1a1a] rounded-[16px] border border-neutral-800/80">
        <Link
          href="/super"
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all no-underline ${
            !fe
              ? 'bg-[#F76911] text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Supermercado
        </Link>
        <Link
          href="/super?lista=feria"
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all no-underline ${
            fe
              ? 'bg-[#F76911] text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Feria
        </Link>
      </div>

      {/* 3. SECCIÓN DE ÍTEMS CON ESTILO FIGMA */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#F76911]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <h2 className="text-base font-bold text-white tracking-tight">
            {fe ? 'Artículos de la Feria' : 'Lista del Supermercado'}
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-400 text-xs">
            {fe
              ? 'No falta nada de la feria. Todo comprado.'
              : 'La lista está vacía. Añade lo que falte en casa.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((i) => (
              <div
                key={i.id}
                className="p-3.5 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex items-center justify-between group"
              >
                <div className="flex flex-col gap-1">
                  <span className="self-start px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fde9da] !text-[#F76911]">
                    {fe ? 'Feria' : 'Compras'}
                  </span>
                  <h3 className="text-sm font-bold text-white leading-snug">
                    {i.name}
                  </h3>
                  <span className="text-[11px] text-neutral-400 font-medium">
                    Pendiente por comprar
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Botón Comprar */}
                  <form action={toggleItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      className="text-xs font-bold text-[#F76911] hover:text-[#F2A957] transition-colors p-1"
                    >
                      Comprar
                    </button>
                  </form>

                  {/* Eliminar */}
                  {canEdit && (
                    <form action={deleteItem}>
                      <input type="hidden" name="id" value={i.id} />
                      <button
                        type="submit"
                        aria-label={`Eliminar ${i.name}`}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                      >
                        <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Historial de comprados */}
        <div className="mt-4">
          <HistoryBox
            title={fe ? 'Comprados en la feria' : 'Comprados recientemente'}
            rows={bought.map((i) => ({ id: i.id, label: i.name }))}
            canEdit={canEdit}
            restore={toggleItem}
            clear={clearBought}
            hidden={{ list }}
          />
        </div>
      </section>

      {/* 4. BOTTOM SHEET ACCIONADO POR EL BOTÓN FLOTANTE */}
      {canEdit && <AddShoppingSheet list={list as 'super' | 'feria'} />}
    </div>
  )
}
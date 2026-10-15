'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addShoppingItem } from '@/app/actions/shopping'
import { useActionParam } from '@/lib/useActionParam'

interface ShoppingItem {
  id: string
  name: string
  category?: string
  done?: boolean
  family_id?: string
  list?: string
}

const CATEGORIES = [
  'Abarrotes',
  'Lácteos y Quesos',
  'Carnes y Pescados',
  'Frutas y Verduras',
  'Limpieza y Aseo',
  'Bebidas y Licores',
  'Panadería y Dulces',
  'Otros',
]

export default function SuperPage() {
  const router = useRouter()
  const supabase = createClient()

  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')

  // Estado del Bottom Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Abarrotes')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  async function loadItems() {
    setLoading(true)
    const { data } = await supabase
      .from('shopping_items')
      .select('*')
      .order('created_at', { ascending: false })

    const superOnly = (data ?? []).filter((item: any) => {
      const listVal = (item.list || item.location || '').toLowerCase()
      return listVal !== 'feria'
    })

    setItems(superOnly)
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  // Abre el sheet si viene del botón + (?action=new)
  useActionParam({ new: openCreate })

  async function toggleDone(item: ShoppingItem) {
    const nextDone = !item.done
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it))
    )
    await supabase
      .from('shopping_items')
      .update({ done: nextDone })
      .eq('id', item.id)
    router.refresh()
  }

  function openCreate() {
    setEditingItem(null)
    setName('')
    setCategory('Abarrotes')
    setIsSheetOpen(true)
  }

  function openEdit(item: ShoppingItem) {
    setEditingItem(item)
    setName(item.name)
    setCategory(item.category || 'Abarrotes')
    setIsSheetOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    if (editingItem) {
      await supabase
        .from('shopping_items')
        .update({ name: name.trim(), category })
        .eq('id', editingItem.id)
    } else {
      const fd = new FormData()
      fd.set('name', name.trim())
      fd.set('list', 'super')
      fd.set('category', category)
      const res = await addShoppingItem(fd)
      if (!res?.ok) {
        alert('No se pudo guardar: ' + (res?.error ?? 'error desconocido'))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    setIsSheetOpen(false)
    loadItems()
  }

  async function handleDelete() {
    if (!editingItem) return
    if (!confirm(`¿Eliminar "${editingItem.name}" de la lista?`)) return
    setDeleting(true)

    await supabase.from('shopping_items').delete().eq('id', editingItem.id)

    setDeleting(false)
    setIsSheetOpen(false)
    loadItems()
  }

  const pendingItems = items.filter((i) => !i.done)
  const completedItems = items.filter((i) => i.done)

  const displayedPending =
    selectedCategory === 'Todos'
      ? pendingItems
      : pendingItems.filter((i) => (i.category || 'Otros') === selectedCategory)

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      
      {/* HEADER ESTANDARIZADO */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white m-0">
            Compras
          </h1>
        </div>

        <NotificationBell />
      </header>

      {/* TABS DE NAVEGACIÓN: SUPERMERCADO ACTIVO / FERIA LIBRE INACTIVO */}
      <nav className="flex p-1 bg-[#1a1a1a] border border-neutral-800/80 rounded-2xl">
        <Link
          href="/super"
          className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl bg-[#F76911] text-white shadow-md transition-all no-underline"
        >
          Supermercado
        </Link>
        <Link
          href="/feria"
          className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl text-neutral-400 hover:text-white transition-all no-underline"
        >
          Feria Libre
        </Link>
      </nav>

      {/* BARRA DE ESTADO Y CATEGORÍAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#1a1a1a] p-4 rounded-[28px] border border-neutral-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400 font-medium">Por comprar:</span>
          <span className="px-3 py-1 rounded-full bg-[#131313] border border-neutral-800 text-xs font-bold text-neutral-200">
            {pendingItems.length} pendientes
          </span>
        </div>

        {/* CHIPS DE CATEGORÍA */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['Todos', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#F76911] text-white shadow-md'
                  : 'bg-[#131313] text-neutral-400 border border-neutral-800 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* LISTADO RESPONSIVO (GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* PENDIENTES */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-300 px-1 m-0">
            Pendientes ({displayedPending.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando lista...
              </div>
            ) : displayedPending.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                No hay productos en esta categoría.
              </div>
            ) : (
              displayedPending.map((item) => (
                <article
                  key={item.id}
                  className="p-4 rounded-[24px] bg-[#1a1a1a] border border-neutral-800/80 hover:border-neutral-700 flex items-center justify-between gap-3 shadow-md transition-all"
                >
                  <div
                    onClick={() => openEdit(item)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h3 className="text-sm font-bold text-white truncate m-0">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      {item.category || 'Abarrotes'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDone(item)}
                      className="w-10 h-10 rounded-2xl border border-neutral-700 hover:border-[#F76911] flex items-center justify-center cursor-pointer transition-all active:scale-95"
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {/* YA COMPRADOS */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-400 px-1 m-0">
            Comprados ({completedItems.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {completedItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-600 bg-[#151515] rounded-[28px] border border-neutral-800/40">
                Ningún producto comprado aún.
              </div>
            ) : (
              completedItems.map((item) => (
                <article
                  key={item.id}
                  className="p-4 rounded-[24px] bg-[#151515] border border-neutral-800/40 opacity-60 flex items-center justify-between gap-3"
                >
                  <div
                    onClick={() => openEdit(item)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <h3 className="text-sm font-bold text-neutral-400 line-through truncate m-0">
                      {item.name}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                      {item.category || 'Abarrotes'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleDone(item)}
                      style={orangeGradient}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

      </div>

      {/* BOTÓN FLOTANTE (FAB) */}
      <button
        type="button"
        onClick={openCreate}
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_20px_rgba(247,105,17,0.4)] active:scale-90 transition-transform cursor-pointer z-30"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* BOTTOM SHEET CREAR / EDITAR */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-black text-white m-0">
                {editingItem ? 'Editar producto' : 'Añadir al supermercado'}
              </h2>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Producto</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Leche descremada, Arroz, Detergente"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Categoría</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#1a1a1a] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral-400">
                    <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSheetOpen(false)}
                    className="w-1/2 py-3.5 rounded-2xl bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer hover:bg-neutral-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={orangeGradient}
                    className="w-1/2 py-3.5 rounded-2xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Añadir'}
                  </button>
                </div>

                {editingItem && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="w-full py-2.5 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/40 font-bold text-xs cursor-pointer transition-colors mt-1"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar este producto'}
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}
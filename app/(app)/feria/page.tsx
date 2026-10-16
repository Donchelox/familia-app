'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActionParam } from '@/lib/useActionParam'
import { offlineDB } from '@/lib/offline/db'
import { useOfflineMutation } from '@/lib/offline/useOfflineMutation'

import { getOfflineFamilyId } from '@/lib/offline/familyContext'

interface FeriaItem {
  id: string
  name: string
  quantity?: string
  done?: boolean
  family_id?: string
  list?: string
}

const COMMON_UNITS = ['1 kg', '2 kg', '500g', '1 atado', '1 malla', '1 docena', '1 unidad']

export default function FeriaPage() {
  const router = useRouter()
  const supabase = createClient()
  const { mutate } = useOfflineMutation()

  const [items, setItems] = useState<FeriaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [familyId, setFamilyId] = useState<string>('')

  // Estado del Bottom Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FeriaItem | null>(null)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1 kg')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  async function loadItems() {
    setLoading(true)

    // 1. Cargar de inmediato desde Dexie (persistencia offline sin latencia de red)
    try {
      const fallbackFamId = await getOfflineFamilyId()
      if (!familyId && fallbackFamId) setFamilyId(fallbackFamId)

      const localData = fallbackFamId
        ? await offlineDB.shopping_lists.where('family_id').equals(fallbackFamId).toArray()
        : []
      const localFeria = localData
        .filter((i) => i.list === 'feria')
        .map((i) => ({ ...i, quantity: (i as any).quantity || '1 kg' }))
      if (localFeria.length > 0) {
        setItems(localFeria)
        if (localFeria[0].family_id && !familyId) setFamilyId(localFeria[0].family_id)
        setLoading(false)
      }
    } catch (e) {
      console.warn('[Offline] Error leyendo feria local:', e)
    }

    // 2. Si hay conexión, descargar de Supabase y sincronizar caché local Dexie
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        let currentFamId = familyId
        if (!currentFamId) {
          try {
            const { data: memberData } = await supabase
              .from('members')
              .select('family_id')
              .limit(1)
              .maybeSingle()
            if (memberData?.family_id) {
              currentFamId = memberData.family_id
              setFamilyId(memberData.family_id)
            }
          } catch {}
        }
        if (!currentFamId) {
          currentFamId = await getOfflineFamilyId()
          if (currentFamId) setFamilyId(currentFamId)
        }

        let query = supabase
          .from('shopping_items')
          .select('id, family_id, list, name, quantity, done, done_at, created_at')
          .eq('list', 'feria')
          .order('created_at', { ascending: false })
          .limit(200)

        if (currentFamId) {
          query = query.eq('family_id', currentFamId)
        }

        const timeoutPromise = new Promise<{ data: any[]; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de consulta remota')), 8000)
        )

        const { data, error } = await Promise.race([query, timeoutPromise])

        if (error) throw error

        if (data && data.length > 0) {
          const feriaOnly = data.filter((item: any) => {
            const listVal = (item.list || item.location || '').toLowerCase()
            return listVal === 'feria'
          })

          // Preservar elementos locales de feria no sincronizados aún
          const currentLocal = await offlineDB.shopping_lists.toArray()
          const unsyncedFeria = currentLocal.filter((i) => i.list === 'feria' && !i._synced)
          const unsyncedMap = new Map(unsyncedFeria.map((i) => [i.id, i]))

          const mergedMap = new Map<string, FeriaItem>()
          unsyncedFeria.forEach((i) => mergedMap.set(i.id, i as any))
          feriaOnly.forEach((rem: any) => {
            if (!unsyncedMap.has(rem.id)) mergedMap.set(rem.id, rem)
          })

          const finalItems = Array.from(mergedMap.values())
          setItems(finalItems)
          if (data.length > 0 && data[0].family_id) {
            setFamilyId(data[0].family_id)
          }

          // Actualizar base de datos local Dexie preservando pendientes
          const serverToStore = feriaOnly
            .filter((rem: any) => !unsyncedMap.has(rem.id))
            .map((item: any) => ({
              id: item.id,
              family_id: item.family_id,
              list: 'feria' as const,
              name: item.name,
              quantity: item.quantity || '1 kg',
              done: item.done || false,
              done_at: item.done_at,
              created_at: item.created_at,
              _synced: true,
            }))

          if (serverToStore.length > 0) {
            await offlineDB.shopping_lists.bulkPut(serverToStore)
          }
        }
      } catch (err) {
        console.warn('[Offline] Petición remota fallida o con timeout, usando caché local:', err)
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()

    function handleSync() {
      loadItems()
    }
    window.addEventListener('casa-sync-complete', handleSync)
    window.addEventListener('online', handleSync)

    return () => {
      window.removeEventListener('casa-sync-complete', handleSync)
      window.removeEventListener('online', handleSync)
    }
  }, [])

  // Abre el sheet si viene del botón + (?action=new)
  useActionParam({ new: openCreate })

  async function toggleDone(item: FeriaItem) {
    const nextDone = !item.done
    const targetFamId = item.family_id || familyId || (await getOfflineFamilyId())

    // Optimistic UI inmediato
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it))
    )

    // Mutación Offline-First
    await mutate({
      familyId: targetFamId,
      entity: 'shopping_lists',
      action: 'UPDATE',
      entityId: item.id,
      payload: {
        id: item.id,
        family_id: targetFamId,
        name: item.name,
        quantity: item.quantity || '1 kg',
        list: 'feria',
        done: nextDone,
        done_at: nextDone ? new Date().toISOString() : null,
      },
    })
  }

  function openCreate() {
    setEditingItem(null)
    setName('')
    setQuantity('1 kg')
    setIsSheetOpen(true)
  }

  function openEdit(item: FeriaItem) {
    setEditingItem(item)
    setName(item.name)
    setQuantity(item.quantity || '1 kg')
    setIsSheetOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const trimmedName = name.trim()
    const trimmedQty = quantity.trim()
    const targetFamId = (editingItem ? editingItem.family_id : familyId) || (await getOfflineFamilyId())
    if (!familyId) setFamilyId(targetFamId)

    if (editingItem) {
      // Actualización optimista local
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItem.id ? { ...it, name: trimmedName, quantity: trimmedQty } : it
        )
      )

      await mutate({
        familyId: targetFamId,
        entity: 'shopping_lists',
        action: 'UPDATE',
        entityId: editingItem.id,
        payload: {
          id: editingItem.id,
          family_id: targetFamId,
          name: trimmedName,
          list: 'feria',
          quantity: trimmedQty,
        },
      })
    } else {
      const tempId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `feria_${Date.now()}`

      const newItem: FeriaItem = {
        id: tempId,
        name: trimmedName,
        quantity: trimmedQty,
        done: false,
        family_id: targetFamId,
        list: 'feria',
      }

      // Inserción optimista local
      setItems((prev) => [newItem, ...prev])

      await mutate({
        familyId: targetFamId,
        entity: 'shopping_lists',
        action: 'INSERT',
        entityId: tempId,
        payload: {
          id: tempId,
          family_id: targetFamId,
          name: trimmedName,
          list: 'feria',
          quantity: trimmedQty,
          done: false,
          created_at: new Date().toISOString(),
        },
      })
    }

    setSaving(false)
    setIsSheetOpen(false)
  }

  async function handleDelete() {
    if (!editingItem) return
    if (!confirm(`¿Eliminar "${editingItem.name}" de la lista de feria?`)) return
    setDeleting(true)

    const targetFamId = editingItem.family_id || familyId || (await getOfflineFamilyId())

    // Eliminación optimista local
    setItems((prev) => prev.filter((it) => it.id !== editingItem.id))

    await mutate({
      familyId: targetFamId,
      entity: 'shopping_lists',
      action: 'DELETE',
      entityId: editingItem.id,
    })

    setDeleting(false)
    setIsSheetOpen(false)
  }

  const pendingItems = items.filter((i) => !i.done)
  const completedItems = items.filter((i) => i.done)

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      
      {/* HEADER ESTANDARIZADO CON MICRO-INDICADOR DE RED */}
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

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* TABS DE NAVEGACIÓN: SUPERMERCADO INACTIVO / FERIA LIBRE ACTIVO */}
      <nav className="flex p-1 bg-[#1a1a1a] border border-neutral-800/80 rounded-2xl">
        <Link
          href="/super"
          className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl text-neutral-400 hover:text-white transition-all no-underline"
        >
          Supermercado
        </Link>
        <Link
          href="/feria"
          className="flex-1 py-2.5 text-center text-xs font-bold rounded-xl bg-[#F76911] text-white shadow-md transition-all no-underline"
        >
          Feria Libre
        </Link>
      </nav>

      {/* BARRA DE ESTADO */}
      <div className="flex items-center justify-between bg-[#1a1a1a] p-4 rounded-[28px] border border-neutral-800/80">
        <span className="text-xs text-neutral-400 font-medium">Compras frescas para la feria:</span>
        <span className="px-3 py-1 rounded-full bg-[#131313] border border-neutral-800 text-xs font-bold text-neutral-200">
          {pendingItems.length} por comprar
        </span>
      </div>

      {/* LISTADOS RESPONSIVOS EN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* PENDIENTES */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-300 px-1 m-0">
            Por comprar ({pendingItems.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando lista de feria...
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                ¡Lista de feria completada!
              </div>
            ) : (
              pendingItems.map((item) => (
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
                    <p className="text-[11px] text-[#F76911] font-semibold mt-0.5 truncate">
                      {item.quantity || '1 kg'}
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

        {/* COMPRADOS */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-400 px-1 m-0">
            Comprados ({completedItems.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {completedItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-600 bg-[#151515] rounded-[28px] border border-neutral-800/40">
                Ninguna verdura o fruta comprada aún.
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
                      {item.quantity || '1 kg'}
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
                {editingItem ? 'Editar ítem de feria' : 'Añadir a la feria'}
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
                <label className="text-[11px] font-bold text-neutral-300">Producto o verdura</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Paltas Hass, Tomates, Cilantro, Huevos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Cantidad o medida</label>
                <input
                  type="text"
                  placeholder="Ej. 1 kg, 2 atados, 1 malla"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
                
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
                  {COMMON_UNITS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setQuantity(u)}
                      className="px-2.5 py-1 rounded-lg bg-[#131313] border border-neutral-800 text-[10px] text-neutral-400 hover:text-white cursor-pointer shrink-0"
                    >
                      {u}
                    </button>
                  ))}
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
                    {deleting ? 'Eliminando...' : 'Eliminar de la feria'}
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
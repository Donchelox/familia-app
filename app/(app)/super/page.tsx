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

import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID } from '@/lib/uuid'

interface ShoppingItem {
  id: string
  name: string
  category?: string
  done?: boolean
  family_id?: string
  list?: string
  is_recurring?: boolean
  recurrence_interval_days?: number | null
  last_notified_at?: string | null
  done_at?: string | null
  created_at?: string
}

function formatRecurrenceShort(days?: number | null): string {
  const d = days || 7
  if (d === 1) return 'Diario'
  if (d === 3) return 'Cada 3 días'
  if (d === 7) return 'Semanal (7d)'
  if (d === 14 || d === 15) return 'Quincenal (15d)'
  if (d === 30 || d === 31) return 'Mensual (30d)'
  return `Cada ${d} días`
}

function getCompletedRecurrenceStatus(item: ShoppingItem): { label: string; isDue: boolean } {
  const days = item.recurrence_interval_days || 7
  if (!item.done_at) return { label: `Cada ${days}d`, isDue: false }
  const daysSince = Math.floor((Date.now() - new Date(item.done_at).getTime()) / (1000 * 60 * 60 * 24))
  const remaining = days - daysSince
  if (remaining <= 0) return { label: 'Toca reponer', isDue: true }
  if (remaining === 1) return { label: 'Reponer mañana', isDue: false }
  return { label: `Reponer en ${remaining}d`, isDue: false }
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
] as const

function inferCategoryByName(name: string): string {
  const n = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // Lácteos y Quesos
  if (/\b(leche|queso|quesillo|yogur|yogurt|yoghurt|mantequilla|crema|ricotta|mozzarella|gouda|parmesano|manjar|chamyto|flan|postre)\b/.test(n)) {
    return 'Lácteos y Quesos'
  }

  // Carnes y Pescados
  if (/\b(carne|pollo|vacuno|cerdo|pescado|atun|salmon|reineta|merluza|lomo|posta|pechuga|bistec|molida|hamburguesa|vienesa|vienesas|salchicha|salchichas|jamon|pavo|chorizo|longaniza|costillar|marisco|camaron|camarones)\b/.test(n)) {
    return 'Carnes y Pescados'
  }

  // Frutas y Verduras
  if (/\b(manzana|platano|naranja|limon|palta|lechuga|tomate|cebolla|papa|papas|zanahoria|zapallo|acelga|espinaca|apio|cilantro|perejil|frutilla|uva|arandano|sandia|melon|pepino|choclo|pimenton|ajo|champinon|champinones|pera|durazno)\b/.test(n)) {
    return 'Frutas y Verduras'
  }

  // Limpieza y Aseo
  if (/\b(detergente|suavizante|cloro|lavaloza|lavalozas|jabon|shampoo|acondicionador|dientes|confort|higienico|toalla|limpiador|desinfectante|esponja|basura|trapero|lustramuebles|poett|ajax|desodorante|toallitas)\b/.test(n)) {
    return 'Limpieza y Aseo'
  }

  // Bebidas y Licores
  if (/\b(agua|aguas|bebida|bebidas|coca|sprite|fanta|jugo|jugos|cerveza|cervezas|vino|vinos|pisco|gin|ron|vodka|whisky|nectar|energetica|gatorade)\b/.test(n)) {
    return 'Bebidas y Licores'
  }

  // Panadería y Dulces
  if (/\b(pan|marraqueta|hallulla|molde|pita|galleta|galletas|queque|torta|pastel|chocolate|chocolates|dulce|dulces|medialuna|tostadas|muffins|brownie)\b/.test(n)) {
    return 'Panadería y Dulces'
  }

  // Abarrotes
  if (/\b(arroz|fideo|fideos|pasta|pastas|harina|aceite|azucar|sal|vinagre|salsa|salsas|cereal|cereales|avena|lenteja|lentejas|poroto|porotos|garbanzo|garbanzos|salmas|conserva|conservas|cafe|te|mayonesa|ketchup|mostaza|sopa|caldo)\b/.test(n)) {
    return 'Abarrotes'
  }

  return 'Abarrotes'
}

function getItemCategory(item?: { name?: string; category?: string | null } | null): string {
  if (!item) return 'Abarrotes'
  if (item.category && typeof item.category === 'string' && item.category.trim() && item.category !== 'Otros') {
    const trimmed = item.category.trim()
    const found = CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    if (found) return found
    return trimmed
  }
  if (item.category === 'Otros') {
    return 'Otros'
  }
  return inferCategoryByName(item.name || '')
}


export default function SuperPage() {
  const router = useRouter()
  const supabase = createClient()
  const { mutate } = useOfflineMutation()

  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [familyId, setFamilyId] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [filterType, setFilterType] = useState<'all' | 'recurring' | 'sporadic'>('all')

  // Estado del Bottom Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Abarrotes')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceDays, setRecurrenceDays] = useState(7)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  async function loadItems() {
    setLoading(true)

    // 1. Cargar de inmediato desde Dexie (persistencia offline sin latencia de red)
    try {
      let currentFamId = familyId
      if (!currentFamId) {
        currentFamId = await getOfflineFamilyId()
        if (currentFamId) setFamilyId(currentFamId)
      }

      const localData = currentFamId
        ? await offlineDB.shopping_lists.where('family_id').equals(currentFamId).toArray()
        : await offlineDB.shopping_lists.toArray()

      const nowMs = Date.now()
      const reactivatedItems: ShoppingItem[] = []

      const localSuper = localData
        .filter((i) => i.list !== 'feria')
        .map((i) => {
          const cat = getItemCategory(i)
          const isRec = Boolean(i.is_recurring)
          const interval = i.recurrence_interval_days || 7

          // Si es recurrente, estaba comprado pero ya transcurrieron los días de intervalo, reactivarlo
          if (isRec && i.done && i.done_at) {
            const daysSince = Math.floor((nowMs - new Date(i.done_at).getTime()) / (1000 * 60 * 60 * 24))
            if (daysSince >= interval) {
              const reactivated = {
                ...i,
                category: cat,
                done: false,
                done_at: null,
                is_recurring: isRec,
                recurrence_interval_days: interval,
              }
              reactivatedItems.push(reactivated)
              return reactivated
            }
          }

          return {
            ...i,
            category: cat,
            is_recurring: isRec,
            recurrence_interval_days: i.recurrence_interval_days ?? null,
            done_at: i.done_at ?? null,
          }
        })

      if (localSuper.length > 0) {
        setItems(localSuper)
        if (localSuper[0].family_id && !familyId) {
          setFamilyId(localSuper[0].family_id)
          saveOfflineFamilyId(localSuper[0].family_id)
        }
        setLoading(false)

        // Sincronizar reactivaciones locales a Dexie
        if (reactivatedItems.length > 0) {
          reactivatedItems.forEach((it) => {
            mutate({
              familyId: it.family_id || currentFamId || '',
              entity: 'shopping_lists',
              action: 'UPDATE',
              entityId: it.id,
              payload: {
                id: it.id,
                family_id: it.family_id || currentFamId,
                name: it.name,
                category: getItemCategory(it),
                list: 'super',
                done: false,
                done_at: null,
                is_recurring: true,
                recurrence_interval_days: it.recurrence_interval_days,
              },
            }).catch(() => {})
          })
        }
      }
    } catch (e) {
      console.warn('[Offline] Error leyendo compras locales:', e)
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
              saveOfflineFamilyId(memberData.family_id)
            }
          } catch {}
        }
        if (!currentFamId) {
          currentFamId = await getOfflineFamilyId()
          if (currentFamId) {
            setFamilyId(currentFamId)
            saveOfflineFamilyId(currentFamId)
          }
        }

        let query = supabase
          .from('shopping_items')
          .select('*')
          .order('created_at', { ascending: false })

        if (currentFamId) {
          query = query.eq('family_id', currentFamId)
        }

        const timeoutPromise = new Promise<{ data: any[]; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de consulta remota')), 6000)
        )

        const { data, error } = await Promise.race([query, timeoutPromise])

        if (error) throw error

        if (data) {
          const superOnly = data.filter((item: any) => {
            const listVal = (item.list || item.location || '').toLowerCase()
            return listVal !== 'feria'
          })

          // Preservar elementos locales no sincronizados aún
          const currentLocal = currentFamId
            ? await offlineDB.shopping_lists.where('family_id').equals(currentFamId).toArray()
            : await offlineDB.shopping_lists.toArray()
          const unsyncedSuper = currentLocal.filter((i) => i.list !== 'feria' && !i._synced)
          const unsyncedMap = new Map(unsyncedSuper.map((i) => [i.id, i]))

          const nowMs = Date.now()
          const mergedMap = new Map<string, ShoppingItem>()
          unsyncedSuper.forEach((i) =>
            mergedMap.set(i.id, {
              ...i,
              category: getItemCategory(i),
              is_recurring: Boolean(i.is_recurring),
              recurrence_interval_days: i.recurrence_interval_days ?? null,
            } as any)
          )

          superOnly.forEach((rem: any) => {
            if (!unsyncedMap.has(rem.id)) {
              const isRec = Boolean(rem.is_recurring)
              const interval = rem.recurrence_interval_days || 7
              let isDone = rem.done || false
              let doneAt = rem.done_at

              // Auto-reactivación si el tiempo venció
              if (isRec && isDone && doneAt) {
                const daysSince = Math.floor((nowMs - new Date(doneAt).getTime()) / (1000 * 60 * 60 * 24))
                if (daysSince >= interval) {
                  isDone = false
                  doneAt = null
                }
              }

              mergedMap.set(rem.id, {
                ...rem,
                category: getItemCategory(rem),
                done: isDone,
                done_at: doneAt,
                is_recurring: isRec,
                recurrence_interval_days: rem.recurrence_interval_days ?? null,
              })
            }
          })

          const finalItems = Array.from(mergedMap.values())
          setItems(finalItems)
          if (data.length > 0 && data[0].family_id) {
            setFamilyId(data[0].family_id)
            saveOfflineFamilyId(data[0].family_id)
          }

          // Eliminar de Dexie los que ya no están en Supabase
          const remoteIds = new Set(superOnly.map((r: any) => r.id))
          const toDelete = currentLocal
            .filter((l) => l.list !== 'feria' && l._synced && !remoteIds.has(l.id))
            .map((l) => l.id)
          if (toDelete.length > 0) {
            await offlineDB.shopping_lists.bulkDelete(toDelete)
          }

          // Actualizar base de datos local Dexie preservando pendientes
          const serverToStore = superOnly
            .filter((rem: any) => !unsyncedMap.has(rem.id))
            .map((item: any) => ({
              id: item.id,
              family_id: item.family_id,
              list: 'super' as const,
              name: item.name,
              category: getItemCategory(item),
              done: item.done || false,
              done_at: item.done_at,
              is_recurring: Boolean(item.is_recurring),
              recurrence_interval_days: item.recurrence_interval_days ?? null,
              last_notified_at: item.last_notified_at ?? null,
              created_at: item.created_at,
              _synced: true,
            }))

          if (serverToStore.length > 0) {
            await offlineDB.shopping_lists.bulkPut(serverToStore)
          }
        }
      } catch (err) {
        console.warn('[Offline] Petición remota fallida o con timeout, manteniendo datos locales:', err)
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

  function openCreate() {
    setEditingItem(null)
    setName('')
    setCategory(selectedCategory !== 'Todos' ? selectedCategory : 'Abarrotes')
    setIsRecurring(false)
    setRecurrenceDays(7)
    setIsSheetOpen(true)
  }

  function openEdit(item: ShoppingItem) {
    setEditingItem(item)
    setName(item.name)
    setCategory(getItemCategory(item))
    setIsRecurring(Boolean(item.is_recurring))
    setRecurrenceDays(item.recurrence_interval_days || 7)
    setIsSheetOpen(true)
  }

  // Abre el sheet si viene del botón + (?action=new)
  useActionParam({ new: openCreate })

  async function toggleDone(item: ShoppingItem) {
    const nextDone = !item.done
    const targetFamId = item.family_id || familyId || (await getOfflineFamilyId())
    const nextDoneAt = nextDone ? new Date().toISOString() : null

    // Optimistic UI inmediato
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, done: nextDone, done_at: nextDoneAt } : it))
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
        category: getItemCategory(item),
        list: 'super',
        done: nextDone,
        done_at: nextDoneAt,
        is_recurring: Boolean(item.is_recurring),
        recurrence_interval_days: item.recurrence_interval_days ?? null,
      },
    })
  }

  function handleNameChange(val: string) {
    setName(val)
    if (!editingItem) {
      setCategory(inferCategoryByName(val))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)

    const trimmedName = name.trim()
    const targetFamId = (editingItem ? editingItem.family_id : familyId) || (await getOfflineFamilyId())
    if (!familyId) setFamilyId(targetFamId)

    const effectiveCategory = category || inferCategoryByName(trimmedName)

    if (editingItem) {
      // Actualización optimista local
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItem.id
            ? {
                ...it,
                name: trimmedName,
                category: effectiveCategory,
                is_recurring: isRecurring,
                recurrence_interval_days: isRecurring ? recurrenceDays : null,
              }
            : it
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
          list: 'super',
          category: effectiveCategory,
          is_recurring: isRecurring,
          recurrence_interval_days: isRecurring ? recurrenceDays : null,
        },
      })
    } else {
      const tempId = safeUUID()

      const newItem: ShoppingItem = {
        id: tempId,
        name: trimmedName,
        category: effectiveCategory,
        done: false,
        family_id: targetFamId,
        list: 'super',
        is_recurring: isRecurring,
        recurrence_interval_days: isRecurring ? recurrenceDays : null,
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
          list: 'super',
          category: effectiveCategory,
          done: false,
          is_recurring: isRecurring,
          recurrence_interval_days: isRecurring ? recurrenceDays : null,
          created_at: new Date().toISOString(),
        },
      })
    }

    setSaving(false)
    setIsSheetOpen(false)
  }

  async function handleDelete() {
    if (!editingItem) return
    if (!confirm(`¿Eliminar "${editingItem.name}" de la lista?`)) return
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

  const recurringCount = items.filter((i) => i.is_recurring).length
  const sporadicCount = items.filter((i) => !i.is_recurring).length

  function filterByRecurrence(list: ShoppingItem[]) {
    if (filterType === 'recurring') return list.filter((i) => i.is_recurring)
    if (filterType === 'sporadic') return list.filter((i) => !i.is_recurring)
    return list
  }

  const filteredPending = filterByRecurrence(pendingItems)
  const filteredCompleted = filterByRecurrence(completedItems)

  const displayedPending =
    selectedCategory === 'Todos'
      ? filteredPending
      : filteredPending.filter((i) => getItemCategory(i) === selectedCategory)

  const displayedCompleted =
    selectedCategory === 'Todos'
      ? filteredCompleted
      : filteredCompleted.filter((i) => getItemCategory(i) === selectedCategory)


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
          <button
            type="button"
            onClick={openCreate}
            style={orangeGradient}
            className="px-3.5 py-1.5 rounded-full text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="text-sm font-black">+</span>
            <span>Producto</span>
          </button>
          <SyncStatusBadge />
          <NotificationBell />
        </div>
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

      {/* BARRA DE ESTADO, FILTROS Y CATEGORÍAS */}
      <div className="flex flex-col gap-3 bg-[#1a1a1a] p-4 rounded-[28px] border border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium">Por comprar:</span>
            <span className="px-3 py-1 rounded-full bg-[#131313] border border-neutral-800 text-xs font-bold text-neutral-200">
              {pendingItems.length} pendientes
            </span>
          </div>

          {/* FILTRO TIPO DE PRODUCTO: TODOS / RECURRENTES / ESPORÁDICOS */}
          <div className="flex items-center gap-1.5 p-1 bg-[#131313] border border-neutral-800/80 rounded-2xl overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#F76911] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('recurring')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'recurring'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🔄</span>
              <span>Recurrentes ({recurringCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sporadic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === 'sporadic'
                  ? 'bg-neutral-700 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🛍️</span>
              <span>Esporádicos ({sporadicCount})</span>
            </button>
          </div>
        </div>

        {/* CHIPS DE CATEGORÍA */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 sm:pb-0 scrollbar-none border-t border-neutral-800/50">
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
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-300 m-0">
              Pendientes ({displayedPending.length})
            </h2>
            {filterType !== 'all' && (
              <span className="text-[11px] text-neutral-500">
                Filtrado por: {filterType === 'recurring' ? 'Recurrentes' : 'Esporádicos'}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando lista...
              </div>
            ) : displayedPending.length === 0 ? (
              <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center">
                <p className="text-sm font-bold text-neutral-300 m-0">No hay productos en esta selección</p>
                <p className="text-xs text-neutral-500 mt-1">Usa el botón para añadir productos a tu lista.</p>
                <button
                  type="button"
                  onClick={openCreate}
                  style={orangeGradient}
                  className="mt-4 px-4 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Añadir producto</span>
                </button>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white truncate m-0">
                        {item.name}
                      </h3>
                      {item.is_recurring ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold">
                          <span>🔄</span>
                          <span>{formatRecurrenceShort(item.recurrence_interval_days)}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800/80 border border-neutral-700/60 text-neutral-400 text-[10px] font-medium">
                          <span>🛍️</span>
                          <span>Esporádico</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5 truncate">
                      {getItemCategory(item)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(item)
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDone(item)
                      }}
                      title="Marcar como comprado"
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
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-400 m-0">
              Comprados ({displayedCompleted.length})
            </h2>
            {filterType !== 'all' && (
              <span className="text-[11px] text-neutral-500">
                Filtrado por: {filterType === 'recurring' ? 'Recurrentes' : 'Esporádicos'}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            {displayedCompleted.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-600 bg-[#151515] rounded-[28px] border border-neutral-800/40">
                Ningún producto comprado aún.
              </div>
            ) : (
              displayedCompleted.map((item) => {
                const recurrenceStatus = item.is_recurring ? getCompletedRecurrenceStatus(item) : null
                return (
                  <article
                    key={item.id}
                    className="p-4 rounded-[24px] bg-[#151515] border border-neutral-800/40 opacity-70 hover:opacity-100 flex items-center justify-between gap-3 transition-opacity"
                  >
                    <div
                      onClick={() => openEdit(item)}
                      className="flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-neutral-400 line-through truncate m-0">
                          {item.name}
                        </h3>
                        {item.is_recurring && recurrenceStatus ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                              recurrenceStatus.isDue
                                ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                                : 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400'
                            }`}
                          >
                            <span>🔄</span>
                            <span>{recurrenceStatus.label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-800/50 border border-neutral-700/40 text-neutral-500 text-[10px]">
                            <span>🛍️</span>
                            <span>Esporádico</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                        {getItemCategory(item)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(item)
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-700/30 text-neutral-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDone(item)
                        }}
                        style={orangeGradient}
                        title="Desmarcar y volver a pendientes"
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md cursor-pointer transition-all active:scale-95"
                      >
                        <svg className="w-5 h-5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>

      </div>

      {/* BOTÓN FLOTANTE (FAB) */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="Añadir producto al supermercado"
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:bottom-24 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_24px_rgba(247,105,17,0.5)] hover:scale-105 active:scale-90 transition-transform cursor-pointer z-40 border-2 border-white/20"
      >
        <svg className="w-7 h-7 stroke-current stroke-2 fill-none pointer-events-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* BOTTOM SHEET CREAR / EDITAR */}
      {isSheetOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSheetOpen(false)
          }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto mb-20 sm:mb-0"
          >
            
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
                  onChange={(e) => handleNameChange(e.target.value)}
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

              {/* FRECUENCIA DE COMPRA: ESPORÁDICO VS RECURRENTE */}
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-[11px] font-bold text-neutral-300">
                  Tipo de producto
                </label>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecurring(false)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      !isRecurring
                        ? 'bg-[#221c17] border-[#F76911] text-white shadow-sm ring-1 ring-[#F76911]/30'
                        : 'bg-[#131313] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🛍️</span>
                      <span className="text-xs font-bold text-white">Esporádico</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      Compra puntual / única vez
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRecurring(true)}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isRecurring
                        ? 'bg-[#14221a] border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/30'
                        : 'bg-[#131313] border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🔄</span>
                      <span className="text-xs font-bold text-white">Recurrente</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      Se compra con frecuencia
                    </span>
                  </button>
                </div>
              </div>

              {/* DETALLES DE RECURRENCIA (SI ES RECURRENTE) */}
              {isRecurring && (
                <div className="flex flex-col gap-2.5 p-3.5 bg-[#141d17] border border-emerald-900/60 rounded-2xl animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ¿Cada cuánto notificar su compra?
                    </label>
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                      Cada {recurrenceDays} {recurrenceDays === 1 ? 'día' : 'días'}
                    </span>
                  </div>

                  {/* CHIPS RÁPIDOS */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '3 días', days: 3 },
                      { label: 'Semanal', days: 7 },
                      { label: '15 días', days: 15 },
                      { label: 'Mensual', days: 30 },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setRecurrenceDays(opt.days)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center ${
                          recurrenceDays === opt.days
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-[#18231c] text-neutral-300 border border-emerald-900/40 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* INPUT / STEPPER PERSONALIZADO */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-neutral-400 shrink-0">O personalizar días:</span>
                    <div className="flex items-center gap-1.5 flex-1">
                      <button
                        type="button"
                        onClick={() => setRecurrenceDays((prev) => Math.max(1, prev - 1))}
                        className="w-8 h-8 rounded-xl bg-[#1b2820] text-neutral-300 hover:text-white border border-emerald-900/50 flex items-center justify-center font-bold text-sm cursor-pointer active:scale-95"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={recurrenceDays}
                        onChange={(e) => setRecurrenceDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                        className="w-16 text-center bg-[#101712] border border-emerald-900/60 rounded-xl py-1.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setRecurrenceDays((prev) => Math.min(365, prev + 1))}
                        className="w-8 h-8 rounded-xl bg-[#1b2820] text-neutral-300 hover:text-white border border-emerald-900/50 flex items-center justify-center font-bold text-sm cursor-pointer active:scale-95"
                      >
                        +
                      </button>
                      <span className="text-[11px] text-neutral-400 ml-1">días</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-emerald-400/80 m-0 pt-0.5">
                    💡 Tras comprarlo, te avisaremos automáticamente al transcurrir {recurrenceDays} días para volver a reponerlo.
                  </p>
                </div>
              )}

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
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

interface TodoItem {
  id: string
  family_id?: string
  title: string
  assigned_to?: string | null
  due_date?: string | null
  done: boolean
  done_at?: string | null
  is_recurring?: boolean
  recurrence_interval_days?: number | null
  created_at?: string
}

interface FamilyMember {
  id: string
  name: string
}

function formatRecurrenceShort(days?: number | null): string {
  const d = days || 7
  if (d === 1) return 'Diario'
  if (d === 2) return 'Cada 2 días'
  if (d === 3) return 'Cada 3 días'
  if (d === 7) return 'Semanal (7d)'
  if (d === 14 || d === 15) return 'Quincenal (15d)'
  if (d === 30 || d === 31) return 'Mensual (30d)'
  return `Cada ${d} días`
}

function getCompletedRecurrenceStatus(item: TodoItem): { label: string; isDue: boolean } {
  const days = item.recurrence_interval_days || 7
  if (!item.done_at) return { label: `Cada ${days}d`, isDue: false }
  const daysSince = Math.floor((Date.now() - new Date(item.done_at).getTime()) / (1000 * 60 * 60 * 24))
  const remaining = days - daysSince
  if (remaining <= 0) return { label: 'Toca realizar', isDue: true }
  if (remaining === 1) return { label: 'Toca mañana', isDue: false }
  return { label: `En ${remaining}d`, isDue: false }
}

export default function TareasPage() {
  const router = useRouter()
  const supabase = createClient()

  const [todos, setTodos] = useState<TodoItem[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [selectedFilter, setSelectedFilter] = useState<string>('Todas')
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'recurring' | 'sporadic'>('all')

  // Estado del Bottom Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [title, setTitle] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [dueDateTime, setDueDateTime] = useState('') // Formato YYYY-MM-DDTHH:mm
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceDays, setRecurrenceDays] = useState(7)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  // Formato legible para fecha y hora
  function formatDateTime(dateStr?: string | null) {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr

      const datePart = d.toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'short',
      })
      const timePart = d.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      return `${datePart}, ${timePart} hrs`
    } catch {
      return dateStr
    }
  }

  // Comprobar si una tarea ya superó su fecha y hora límite
  function isTaskOverdue(dateStr?: string | null): boolean {
    if (!dateStr) return false
    try {
      if (dateStr.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const endOfDay = new Date(`${dateStr}T23:59:59`)
        return !isNaN(endOfDay.getTime()) && endOfDay.getTime() < Date.now()
      }
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return false
      return d.getTime() < Date.now()
    } catch {
      return false
    }
  }

  // Convertir string de BD a datetime-local (YYYY-MM-DDTHH:mm)
  function toDateTimeLocalValue(dateStr?: string | null) {
    if (!dateStr) return ''
    try {
      if (dateStr.length === 16 && dateStr.includes('T')) return dateStr
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return ''

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  const { mutate } = useOfflineMutation()

  async function loadData() {
    setLoading(true)

    try {
      // 0. Cargar integrantes cacheados para disponibilidad inmediata
      try {
        const cached = localStorage.getItem('casa_family_members')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed)
          }
        }
      } catch {}

      // 1. CARGA INMEDIATA DESDE DEXIE (OFFLINE-FIRST SIN LATENCIA DE RED)
      let currentFamId = familyId
      try {
        if (!currentFamId) {
          currentFamId = await getOfflineFamilyId()
          if (currentFamId) setFamilyId(currentFamId)
        }

        const stored = currentFamId
          ? await offlineDB.todos.where('family_id').equals(currentFamId).toArray()
          : await offlineDB.todos.toArray()

        if (stored && stored.length > 0) {
          const nowMs = Date.now()
          const reactivatedTodos: TodoItem[] = []

          const localTodos = stored.map((t) => {
            const isRec = Boolean(t.is_recurring)
            const interval = t.recurrence_interval_days || 7
            let isDone = t.done || false
            let doneAt = t.done_at
            let dueDate = t.due_date

            // Auto-reactivación si el intervalo de recurrencia ya pasó
            if (isRec && isDone && doneAt) {
              const daysSince = Math.floor((nowMs - new Date(doneAt).getTime()) / (1000 * 60 * 60 * 24))
              if (daysSince >= interval) {
                isDone = false
                doneAt = null
                if (dueDate) {
                  const oldDate = new Date(dueDate)
                  if (!isNaN(oldDate.getTime())) {
                    dueDate = new Date(Date.now() + interval * 86400000).toISOString()
                  }
                }
                reactivatedTodos.push({
                  id: t.id,
                  family_id: t.family_id,
                  title: t.title,
                  assigned_to: t.assigned_to,
                  due_date: dueDate,
                  done: false,
                  done_at: null,
                  is_recurring: true,
                  recurrence_interval_days: interval,
                  created_at: t.created_at,
                })
              }
            }

            return {
              id: t.id,
              family_id: t.family_id,
              title: t.title,
              assigned_to: t.assigned_to,
              due_date: dueDate,
              done: isDone,
              done_at: doneAt,
              is_recurring: isRec,
              recurrence_interval_days: interval,
              created_at: t.created_at,
            }
          })

          setTodos(localTodos)
          if (stored[0]?.family_id && !currentFamId) {
            currentFamId = stored[0].family_id
            setFamilyId(stored[0].family_id)
            saveOfflineFamilyId(stored[0].family_id)
          }
          setLoading(false)

          // Sincronizar reactivaciones locales
          if (reactivatedTodos.length > 0 && currentFamId) {
            reactivatedTodos.forEach((item) => {
              mutate({
                familyId: currentFamId!,
                entity: 'todos',
                action: 'UPDATE',
                entityId: item.id,
                payload: item,
              }).catch(() => {})
            })
          }
        }
      } catch (err) {
        console.warn('[Offline] Error cargando tareas locales:', err)
      }

      // Si no estamos online, terminamos la carga con los datos locales
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      // 2. Obtener family_id remoto si aún no se tiene
      try {
        if (!currentFamId) {
          const { data: memberUser } = await supabase
            .from('members')
            .select('family_id')
            .limit(1)
            .maybeSingle()

          if (memberUser?.family_id) {
            currentFamId = memberUser.family_id
            setFamilyId(memberUser.family_id)
            saveOfflineFamilyId(memberUser.family_id)
          }
        }
      } catch {}

      // 3. Cargar integrantes reales del hogar
      try {
        const membersMap = new Map<string, FamilyMember>()

        let fmQuery = supabase
          .from('family_members')
          .select('id, name')
          .order('created_at', { ascending: true })
        if (currentFamId) fmQuery = fmQuery.eq('family_id', currentFamId)

        const timeoutFm = new Promise<{ data: any[]; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de integrantes')), 5000)
        )
        const { data: fmList } = await Promise.race([fmQuery, timeoutFm]).catch(() => ({ data: null }))

        if (fmList) {
          fmList.forEach((fm: any) => {
            const name = fm.name?.trim()
            if (name) {
              membersMap.set(name.toLowerCase(), {
                id: fm.id,
                name: name,
              })
            }
          })
        }

        const { data: userRes } = await supabase.auth.getUser().catch(() => ({ data: null }))
        const user = userRes?.user
        const currentUserName =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          (user?.email ? user.email.split('@')[0] : '')

        if (currentUserName && currentUserName.trim()) {
          const trimmed = currentUserName.trim()
          if (!membersMap.has(trimmed.toLowerCase())) {
            membersMap.set(trimmed.toLowerCase(), {
              id: user?.id || 'me',
              name: trimmed,
            })
          }
        }

        let mQuery = supabase
          .from('members')
          .select('user_id, display_name')
          .not('display_name', 'is', null)
        if (currentFamId) mQuery = mQuery.eq('family_id', currentFamId)
        let mList: any[] | null = null
        try {
          const res = await mQuery
          mList = res.data
        } catch {}

        if (mList) {
          mList.forEach((m: any) => {
            const name = m.display_name?.trim()
            if (name && !membersMap.has(name.toLowerCase())) {
              membersMap.set(name.toLowerCase(), {
                id: m.user_id,
                name: name,
              })
            }
          })
        }

        const validMembers = Array.from(membersMap.values())
        if (validMembers.length > 0) {
          setMembers(validMembers)
          try {
            localStorage.setItem('casa_family_members', JSON.stringify(validMembers))
          } catch {}
        }
      } catch (err) {
        console.warn('[Offline] Error cargando integrantes remotos:', err)
      }

      // 4. Sincronizar tareas con Supabase (con timeout de 6s para evitar bloqueos)
      try {
        let todosQuery = supabase
          .from('todos')
          .select('*')
          .order('created_at', { ascending: false })

        if (currentFamId) {
          todosQuery = todosQuery.eq('family_id', currentFamId)
        }

        const timeoutPromise = new Promise<{ data: any[]; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout de consulta de tareas')), 6000)
        )

        const { data: todosRes } = await Promise.race([todosQuery, timeoutPromise]).catch(() => ({ data: null }))

        if (todosRes) {
          const currentLocal = currentFamId
            ? await offlineDB.todos.where('family_id').equals(currentFamId).toArray()
            : await offlineDB.todos.toArray()
          const unsyncedItems = currentLocal.filter((t) => !t._synced)
          const unsyncedMap = new Map(unsyncedItems.map((t) => [t.id, t]))
          const localMap = new Map(currentLocal.map((t) => [t.id, t]))

          const nowMs = Date.now()
          const reactivatedTodos: TodoItem[] = []

          const mergedMap = new Map<string, TodoItem>()
          unsyncedItems.forEach((it) => {
            mergedMap.set(it.id, {
              id: it.id,
              family_id: it.family_id,
              title: it.title,
              assigned_to: it.assigned_to,
              due_date: it.due_date,
              done: it.done,
              done_at: it.done_at,
              is_recurring: it.is_recurring,
              recurrence_interval_days: it.recurrence_interval_days,
              created_at: it.created_at,
            })
          })

          todosRes.forEach((rem: any) => {
            if (!unsyncedMap.has(rem.id)) {
              const localIt = localMap.get(rem.id)
              const isRec =
                rem.is_recurring !== undefined && rem.is_recurring !== null
                  ? Boolean(rem.is_recurring)
                  : Boolean(localIt?.is_recurring)
              const interval = (rem.recurrence_interval_days ?? localIt?.recurrence_interval_days) || 7

              let isDone = rem.done || false
              let doneAt = rem.done_at
              let dueDate = rem.due_date

              if (isRec && isDone && doneAt) {
                const daysSince = Math.floor((nowMs - new Date(doneAt).getTime()) / (1000 * 60 * 60 * 24))
                if (daysSince >= interval) {
                  isDone = false
                  doneAt = null
                  if (dueDate) {
                    const oldDate = new Date(dueDate)
                    if (!isNaN(oldDate.getTime())) {
                      dueDate = new Date(Date.now() + interval * 86400000).toISOString()
                    }
                  }
                  reactivatedTodos.push({
                    id: rem.id,
                    family_id: rem.family_id,
                    title: rem.title,
                    assigned_to: rem.assigned_to,
                    due_date: dueDate,
                    done: false,
                    done_at: null,
                    is_recurring: true,
                    recurrence_interval_days: interval,
                    created_at: rem.created_at,
                  })
                }
              }

              mergedMap.set(rem.id, {
                id: rem.id,
                family_id: rem.family_id,
                title: rem.title,
                assigned_to: rem.assigned_to,
                due_date: dueDate,
                done: isDone,
                done_at: doneAt,
                is_recurring: isRec,
                recurrence_interval_days: interval,
                created_at: rem.created_at,
              })
            }
          })

          const mergedList = Array.from(mergedMap.values())
          setTodos(mergedList)

          // Limpiar en Dexie los registros sincronizados eliminados en el servidor
          const remoteIds = new Set(todosRes.map((rem: any) => rem.id))
          const toDelete = currentLocal
            .filter((rem) => rem._synced && !remoteIds.has(rem.id))
            .map((rem) => rem.id)
          if (toDelete.length > 0) {
            await offlineDB.todos.bulkDelete(toDelete)
          }

          // Respaldar servidor en Dexie sin sobrescribir los no sincronizados
          const serverToStore = todosRes
            .filter((rem: any) => !unsyncedMap.has(rem.id))
            .map((rem: any) => {
              const localIt = localMap.get(rem.id)
              return {
                id: rem.id,
                family_id: rem.family_id,
                title: rem.title,
                assigned_to: rem.assigned_to,
                due_date: rem.due_date,
                done: rem.done || false,
                done_at: rem.done_at,
                is_recurring:
                  rem.is_recurring !== undefined && rem.is_recurring !== null
                    ? Boolean(rem.is_recurring)
                    : Boolean(localIt?.is_recurring),
                recurrence_interval_days:
                  (rem.recurrence_interval_days ?? localIt?.recurrence_interval_days) || null,
                created_at: rem.created_at,
                _synced: true,
              }
            })

          if (serverToStore.length > 0) {
            await offlineDB.todos.bulkPut(serverToStore)
          }

          if (reactivatedTodos.length > 0 && currentFamId) {
            reactivatedTodos.forEach((item) => {
              mutate({
                familyId: currentFamId!,
                entity: 'todos',
                action: 'UPDATE',
                entityId: item.id,
                payload: item,
              }).catch(() => {})
            })
          }
        }
      } catch (err) {
        console.warn('[Offline] Error descargando tareas de Supabase, manteniendo datos locales:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Re-cargar automáticamente si la sincronización en segundo plano sube cambios
    function handleSyncComplete() {
      loadData()
    }
    window.addEventListener('casa-sync-complete', handleSyncComplete)
    window.addEventListener('online', handleSyncComplete)

    return () => {
      window.removeEventListener('casa-sync-complete', handleSyncComplete)
      window.removeEventListener('online', handleSyncComplete)
    }
  }, [])

  // Abre el sheet si viene del botón + (?action=new)
  useActionParam({ new: openCreate })

  // Check / Uncheck tarea
  async function toggleDone(todo: TodoItem) {
    const nextDone = !todo.done
    const nextDoneAt = nextDone ? new Date().toISOString() : null
    const targetFamId = todo.family_id || familyId || (await getOfflineFamilyId())

    // 1. Optimistic UI inmediato en React
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, done: nextDone, done_at: nextDoneAt } : t
      )
    )

    // 2. Persistencia offline garantizada en Dexie y encolado en sync_queue
    try {
      await mutate({
        familyId: targetFamId,
        entity: 'todos',
        action: 'UPDATE',
        entityId: todo.id,
        payload: {
          id: todo.id,
          family_id: targetFamId,
          title: todo.title,
          assigned_to: todo.assigned_to,
          due_date: todo.due_date,
          done: nextDone,
          done_at: nextDoneAt,
          is_recurring: todo.is_recurring ?? false,
          recurrence_interval_days: todo.recurrence_interval_days ?? null,
        },
      })
    } catch (e) {
      console.warn('[Offline] Error mutando estado de tarea localmente:', e)
    }
  }

  // Apertura Bottom Sheet
  function openCreate() {
    setEditingTodo(null)
    setTitle('')
    setSelectedMembers([])
    setDueDateTime('')
    setIsRecurring(false)
    setRecurrenceDays(7)
    setIsSheetOpen(true)
  }

  function openEdit(todo: TodoItem) {
    setEditingTodo(todo)
    setTitle(todo.title || '')
    const initialMembers = todo.assigned_to
      ? todo.assigned_to
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    setSelectedMembers(initialMembers)
    setDueDateTime(toDateTimeLocalValue(todo.due_date))
    setIsRecurring(Boolean(todo.is_recurring))
    setRecurrenceDays(todo.recurrence_interval_days || 7)
    setIsSheetOpen(true)
  }

  // Alternar selección de un integrante
  function toggleMemberSelection(name: string) {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
  }

  // Seleccionar todos los integrantes
  function selectAllMembers() {
    setSelectedMembers(allAvailableMembers)
  }

  // Desasignar (dejar para toda la familia)
  function clearSelectedMembers() {
    setSelectedMembers([])
  }

  // Guardar (Crear o Editar en 'todos')
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const targetFamilyId = familyId || (await getOfflineFamilyId())
    const tempId = editingTodo?.id || safeUUID()

    const assignedToString = selectedMembers.length > 0 ? selectedMembers.join(', ') : null

    const payload: TodoItem = {
      id: tempId,
      family_id: targetFamilyId,
      title: title.trim(),
      assigned_to: assignedToString,
      due_date: dueDateTime ? new Date(dueDateTime).toISOString() : null,
      done: editingTodo ? editingTodo.done : false,
      done_at: editingTodo ? editingTodo.done_at : null,
      is_recurring: isRecurring,
      recurrence_interval_days: isRecurring ? (recurrenceDays || 7) : null,
      created_at: editingTodo?.created_at || new Date().toISOString(),
    }

    // 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA EN REACT
    setTodos((prev) => {
      if (editingTodo) {
        return prev.map((t) => (t.id === editingTodo.id ? payload : t))
      } else {
        return [payload, ...prev]
      }
    })

    // 2. PERSISTENCIA OFFLINE EN DEXIE Y ENCOLADO EN SYNC_QUEUE
    try {
      await mutate({
        familyId: targetFamilyId,
        entity: 'todos',
        action: editingTodo ? 'UPDATE' : 'INSERT',
        entityId: tempId,
        payload: {
          id: tempId,
          family_id: targetFamilyId,
          title: payload.title,
          assigned_to: payload.assigned_to,
          due_date: payload.due_date,
          done: payload.done,
          done_at: payload.done_at,
          is_recurring: payload.is_recurring,
          recurrence_interval_days: payload.recurrence_interval_days,
          created_at: payload.created_at,
        },
      })
    } catch (err) {
      console.warn('[Offline] Tarea encolada localmente con éxito:', err)
    }

    setIsSheetOpen(false)
    setTitle('')
    setDueDateTime('')
    setSelectedMembers([])
    setIsRecurring(false)
    setRecurrenceDays(7)
    setSaving(false)
  }

  // Eliminar tarea
  async function handleDelete() {
    if (!editingTodo) return
    if (!confirm('¿Eliminar esta tarea definitivamente?')) return
    setDeleting(true)

    const targetId = editingTodo.id
    const targetFamId = editingTodo.family_id || familyId || (await getOfflineFamilyId())

    // 1. Optimistic UI delete
    setTodos((prev) => prev.filter((t) => t.id !== targetId))

    // 2. Mutación offline-first (elimina de Dexie y encola DELETE para Supabase)
    try {
      await mutate({
        familyId: targetFamId,
        entity: 'todos',
        action: 'DELETE',
        entityId: targetId,
      })
    } catch (err) {
      console.warn('[Offline] Eliminación encolada localmente:', err)
    }

    setIsSheetOpen(false)
    setDeleting(false)
  }

  function matchesFilter(todo: TodoItem, filter: string) {
    if (filter === 'Todas') return true
    if (filter === 'Sin asignar') return !todo.assigned_to || todo.assigned_to.trim() === ''
    if (!todo.assigned_to) return false
    const assignedList = todo.assigned_to
      .split(',')
      .map((s) => s.trim().toLowerCase())
    return assignedList.includes(filter.toLowerCase())
  }

  function matchesRecurrence(todo: TodoItem, filter: 'all' | 'recurring' | 'sporadic') {
    if (filter === 'all') return true
    if (filter === 'recurring') return Boolean(todo.is_recurring)
    if (filter === 'sporadic') return !todo.is_recurring
    return true
  }

  const pendingTodos = todos.filter((t) => !t.done)
  const completedTodos = todos.filter((t) => t.done)

  const recurringCount = todos.filter((t) => t.is_recurring).length
  const sporadicCount = todos.filter((t) => !t.is_recurring).length

  const displayedPending = pendingTodos.filter(
    (t) => matchesFilter(t, selectedFilter) && matchesRecurrence(t, recurrenceFilter)
  )
  const displayedCompleted = completedTodos.filter(
    (t) => matchesFilter(t, selectedFilter) && matchesRecurrence(t, recurrenceFilter)
  )

  // Integrantes únicos para los chips de filtro (miembros registrados + asignados)
  const filterMembers = Array.from(
    new Set([
      'Todas',
      ...members.map((m) => m.name),
      ...todos.flatMap((t) =>
        t.assigned_to ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean) : []
      ),
    ])
  )

  // Integrantes disponibles para asignación (miembros registrados + los que ya tenga la tarea)
  const allAvailableMembers = Array.from(
    new Set([
      ...members.map((m) => m.name),
      ...selectedMembers,
    ])
  )

  return (
    <div className="w-full flex flex-col gap-6 select-none">
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
            Tareas del Hogar
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* BARRA DE ESTADO Y FILTROS */}
      <div className="flex flex-col gap-3 bg-[#1a1a1a] p-4 rounded-[28px] border border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400 font-medium">Por realizar:</span>
            <span className="px-3 py-1 rounded-full bg-[#131313] border border-neutral-800 text-xs font-bold text-neutral-200">
              {selectedFilter === 'Todas' && recurrenceFilter === 'all'
                ? `${pendingTodos.length} pendientes`
                : `${displayedPending.length} pendientes`}
            </span>
          </div>

          {/* TABS RECURRENTE / PUNTUAL / TODAS */}
          <div className="flex items-center gap-1 bg-[#131313] p-1 rounded-2xl border border-neutral-800/80 self-start sm:self-auto overflow-x-auto max-w-full scrollbar-none">
            <button
              type="button"
              onClick={() => setRecurrenceFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                recurrenceFilter === 'all'
                  ? 'bg-neutral-700 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todas ({todos.length})
            </button>
            <button
              type="button"
              onClick={() => setRecurrenceFilter('recurring')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                recurrenceFilter === 'recurring'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🔄</span>
              <span>Recurrentes ({recurringCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setRecurrenceFilter('sporadic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                recurrenceFilter === 'sporadic'
                  ? 'bg-[#F76911] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>📌</span>
              <span>Puntuales ({sporadicCount})</span>
            </button>
          </div>
        </div>

        {/* CHIPS DE FILTRO POR INTEGRANTE */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 sm:pb-0 scrollbar-none border-t border-neutral-800/60">
          <span className="text-[11px] text-neutral-400 font-semibold shrink-0">Asignada:</span>
          {filterMembers.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSelectedFilter(f)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
                selectedFilter === f
                  ? 'bg-[#F76911] text-white shadow-md'
                  : 'bg-[#131313] text-neutral-400 border border-neutral-800 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* GRID RESPONSIVO: PENDIENTES Y COMPLETADAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* COLUMNA PENDIENTES */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-300 px-1 m-0">
            Pendientes ({displayedPending.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando tareas...
              </div>
            ) : displayedPending.length === 0 ? (
              <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center">
                <p className="text-sm font-bold text-neutral-300 m-0">No hay tareas pendientes</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                  {selectedFilter === 'Todas' ? '¡Todo al día en la casa!' : `No hay tareas asignadas a "${selectedFilter}".`}
                </p>
                <button
                  type="button"
                  onClick={openCreate}
                  style={orangeGradient}
                  className="mt-4 px-4 py-2 rounded-2xl text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Añadir nueva tarea</span>
                </button>
              </div>
            ) : (
              displayedPending.map((t) => {
                const formattedDate = formatDateTime(t.due_date)
                const isOverdue = isTaskOverdue(t.due_date)
                const assignedList = t.assigned_to
                  ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean)
                  : []

                return (
                  <article
                    key={t.id}
                    className={`p-4 rounded-[24px] bg-[#1a1a1a] border shadow-md transition-all flex items-center justify-between gap-3 ${
                      isOverdue
                        ? 'border-red-900/60 hover:border-red-700/80 bg-gradient-to-r from-red-950/20 to-[#1a1a1a]'
                        : 'border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    <div onClick={() => openEdit(t)} className="min-w-0 flex-1 cursor-pointer">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-950/90 text-red-400 border border-red-800/80 text-[10px] font-black uppercase tracking-wider shadow-sm">
                            <span>⚠️</span>
                            <span>Tarea vencida</span>
                          </span>
                        )}
                        {t.is_recurring && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold">
                            <span>🔄</span>
                            <span>{formatRecurrenceShort(t.recurrence_interval_days)}</span>
                          </span>
                        )}
                        {assignedList.map((person) => (
                          <span
                            key={person}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F76911]/15 text-[#F76911] border border-[#F76911]/30 text-[11px] font-bold"
                          >
                            <span className="text-[10px]">👤</span>
                            <span>{person}</span>
                          </span>
                        ))}
                      </div>

                      <h3 className="text-sm font-bold text-white truncate m-0">
                        {t.title}
                      </h3>

                      {formattedDate && (
                        <p className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${isOverdue ? 'text-red-400' : 'text-neutral-400'}`}>
                          <span>⏰ Límite: {formattedDate}</span>
                          {isOverdue && <span className="font-bold text-red-400">• Venció</span>}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(t)
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDone(t)
                        }}
                        className="w-10 h-10 rounded-2xl border border-neutral-700 hover:border-[#F76911] hover:scale-110 active:scale-90 flex items-center justify-center cursor-pointer transition-all duration-150"
                        title="Marcar como completada"
                      />
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>

        {/* COLUMNA COMPLETADAS */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-neutral-400 px-1 m-0">
            Completadas ({displayedCompleted.length})
          </h2>

          <div className="flex flex-col gap-2.5">
            {displayedCompleted.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-600 bg-[#151515] rounded-[28px] border border-neutral-800/40">
                {selectedFilter === 'Todas'
                  ? 'Aún no has completado tareas familiares.'
                  : `No hay tareas completadas para "${selectedFilter}".`}
              </div>
            ) : (
              displayedCompleted.map((t) => {
                const assignedList = t.assigned_to
                  ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean)
                  : []
                const recurrenceStatus = t.is_recurring ? getCompletedRecurrenceStatus(t) : null

                return (
                  <article
                    key={t.id}
                    className="p-4 rounded-[24px] bg-[#151515] border border-neutral-800/40 opacity-70 flex items-center justify-between gap-3"
                  >
                    <div onClick={() => openEdit(t)} className="min-w-0 flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-neutral-400 line-through truncate m-0">
                          {t.title}
                        </h3>
                        {t.is_recurring && recurrenceStatus && (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold shrink-0 ${
                              recurrenceStatus.isDue
                                ? 'bg-amber-950/70 border-amber-800/60 text-amber-300'
                                : 'bg-neutral-800/80 border-neutral-700/60 text-emerald-400'
                            }`}
                          >
                            <span>🔄</span>
                            <span>{recurrenceStatus.label}</span>
                          </span>
                        )}
                      </div>
                      {assignedList.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[11px] text-neutral-500 font-medium">
                            Asignada a:
                          </span>
                          {assignedList.map((person) => (
                            <span
                              key={person}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800/80 text-neutral-400 border border-neutral-700/40 text-[10px] font-medium"
                            >
                              <span>👤</span>
                              <span>{person}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(t)
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-700/30 text-neutral-400 text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleDone(t)
                        }}
                        style={orangeGradient}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md cursor-pointer hover:scale-110 active:scale-90 transition-all duration-150"
                        title="Marcar como pendiente"
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

      {/* FLOATING ACTION BUTTON (FAB) */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="Añadir tarea"
        style={orangeGradient}
        className="fixed bottom-24 right-5 sm:bottom-24 sm:right-8 lg:right-12 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_8px_24px_rgba(247,105,17,0.5)] hover:scale-105 active:scale-90 transition-transform cursor-pointer z-40 border-2 border-white/20"
        title="Añadir tarea"
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
                {editingTodo ? 'Editar tarea del hogar' : 'Añadir nueva tarea'}
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
              {/* TÍTULO / DESCRIPCIÓN */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-neutral-300">Descripción de la tarea</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Pagar cuenta de luz, Comprar alimento del conejo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                />
              </div>

              {/* INTEGRANTES DE LA FAMILIA (1 O VARIOS) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300">
                    Asignar a integrante(s)
                  </label>
                  <div className="flex items-center gap-2">
                    {allAvailableMembers.length > 1 && (
                      <button
                        type="button"
                        onClick={
                          selectedMembers.length === allAvailableMembers.length
                            ? clearSelectedMembers
                            : selectAllMembers
                        }
                        className="text-[10px] text-[#F76911] hover:underline font-bold cursor-pointer"
                      >
                        {selectedMembers.length === allAvailableMembers.length
                          ? 'Deseleccionar todos'
                          : 'Seleccionar todos'}
                      </button>
                    )}
                    {selectedMembers.length > 0 && selectedMembers.length !== allAvailableMembers.length && (
                      <button
                        type="button"
                        onClick={clearSelectedMembers}
                        className="text-[10px] text-neutral-400 hover:text-white font-medium cursor-pointer"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-[#131313] border border-neutral-800 rounded-2xl flex flex-col gap-2.5">
                  {allAvailableMembers.length === 0 ? (
                    <p className="text-xs text-neutral-400 m-0">
                      No hay integrantes configurados. La tarea quedará visible para todo el hogar.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {/* Botón Toda la familia */}
                        <button
                          type="button"
                          onClick={clearSelectedMembers}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            selectedMembers.length === 0
                              ? 'bg-[#F76911] text-white shadow-md'
                              : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/50 hover:bg-neutral-800'
                          }`}
                        >
                          <span>🏠</span>
                          <span>Toda la familia</span>
                        </button>

                        {/* Chips individuales para 1 o varios integrantes */}
                        {allAvailableMembers.map((name) => {
                          const isSelected = selectedMembers.includes(name)
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleMemberSelection(name)}
                              style={isSelected ? orangeGradient : undefined}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 duration-150 ${
                                isSelected
                                  ? 'text-white shadow-md scale-[1.02]'
                                  : 'bg-neutral-800/60 text-neutral-300 hover:text-white border border-neutral-700/50 hover:bg-neutral-800'
                              }`}
                            >
                              <span>{isSelected ? '✓' : '👤'}</span>
                              <span>{name}</span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Resumen explicativo dinámico */}
                      <div className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/60 flex items-center gap-1.5">
                        <span className="font-semibold text-neutral-300">Asignación:</span>
                        {selectedMembers.length === 0 ? (
                          <span className="text-neutral-400">Sin asignar (Visible para toda la familia)</span>
                        ) : selectedMembers.length === 1 ? (
                          <span className="text-[#F76911] font-medium truncate">
                            Asignada a {selectedMembers[0]}
                          </span>
                        ) : (
                          <span className="text-[#F76911] font-medium truncate">
                            Asignada a {selectedMembers.length} integrantes ({selectedMembers.join(', ')})
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* TIPO DE TAREA: PUNTUAL VS RECURRENTE */}
              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-[11px] font-bold text-neutral-300">
                  Tipo de tarea
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
                      <span className="text-base">📌</span>
                      <span className="text-xs font-bold text-white">Puntual</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 mt-0.5">
                      Tarea única de una sola vez
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
                      Se repite cada X días
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
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      ¿Cada cuántos días se repite?
                    </label>
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                      {formatRecurrenceShort(recurrenceDays)}
                    </span>
                  </div>

                  {/* CHIPS RÁPIDOS */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { label: '1 día', days: 1 },
                      { label: '2 días', days: 2 },
                      { label: '3 días', days: 3 },
                      { label: 'Semanal', days: 7 },
                      { label: '15 días', days: 15 },
                      { label: '30 días', days: 30 },
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
                    💡 Al completar la tarea, se reactivará automáticamente después de {recurrenceDays} {recurrenceDays === 1 ? 'día' : 'días'} para realizarla de nuevo.
                  </p>
                </div>
              )}

              {/* FECHA Y HORA (CALENDARIO COMPLETO TIPO DATETIME-LOCAL) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-neutral-300">
                    Fecha y hora límite (opcional)
                  </label>
                  {dueDateTime && (
                    <button
                      type="button"
                      onClick={() => setDueDateTime('')}
                      className="text-[10px] text-[#F76911] font-bold hover:underline cursor-pointer"
                    >
                      Quitar fecha y hora
                    </button>
                  )}
                </div>
                <input
                  type="datetime-local"
                  value={dueDateTime}
                  onChange={(e) => setDueDateTime(e.target.value)}
                  className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911] cursor-pointer scheme-dark"
                />
                <p className="text-[10px] text-neutral-500 m-0">
                  Define el día, mes, hora y minutos desde el selector interactivo.
                </p>
                {dueDateTime && isTaskOverdue(dueDateTime) && (
                  <p className="text-[11px] text-red-400 font-bold m-0 flex items-center gap-1.5 mt-1">
                    <span>⚠️</span>
                    <span>Esta fecha y hora ya pasaron (Tarea vencida).</span>
                  </p>
                )}
              </div>

              {/* BOTONES */}
              <div className="flex flex-col gap-2 pt-2">
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
                    className="w-1/2 py-3.5 rounded-2xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center"
                  >
                    {saving
                      ? 'Guardando...'
                      : editingTodo
                      ? 'Guardar cambios'
                      : 'Añadir tarea'}
                  </button>
                </div>

                {editingTodo && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="w-full py-2.5 rounded-2xl bg-red-950/40 border border-red-900/60 text-red-400 hover:bg-red-900/40 font-bold text-xs cursor-pointer transition-colors mt-1"
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar esta tarea'}
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
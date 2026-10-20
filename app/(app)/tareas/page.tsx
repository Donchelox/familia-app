'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import SyncStatusBadge from '@/components/SyncStatusBadge'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useActionParam } from '@/lib/useActionParam'
import { offlineDB } from '@/lib/offline/db'
import { useOfflineMutation } from '@/lib/offline/useOfflineMutation'
import { getOfflineFamilyId, saveOfflineFamilyId } from '@/lib/offline/familyContext'
import { safeUUID, isValidUUID } from '@/lib/uuid'

export interface TodoSubtask {
  id: string
  title: string
  details?: string | null
  due_date?: string | null
  done: boolean
  done_at?: string | null
}

export interface TodoCategoryItem {
  id: string
  name: string
  color?: string
}

export type TodoPriority = 'alta' | 'media' | 'normal'

export interface TodoItem {
  id: string
  family_id?: string
  title: string
  details?: string | null
  category?: string | null
  subtasks?: TodoSubtask[]
  priority?: TodoPriority
  position?: number
  archived?: boolean
  link?: string | null
  reminder_sent?: boolean
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

interface SubtaskDraft {
  id: string
  title: string
  details: string
  due_date: string
  done: boolean
  showDetails: boolean
  showReminder: boolean
}

const DEFAULT_CATEGORY: TodoCategoryItem = {
  id: 'default-sin-categoria',
  name: 'Sin categoría',
  color: '#737373',
}

const DEFAULT_CATEGORIES: TodoCategoryItem[] = [DEFAULT_CATEGORY]

function sanitizeCategories(list: TodoCategoryItem[]): TodoCategoryItem[] {
  const exampleNames = ['tareas de la casa', 'tareas personales', 'tareas financieras']
  const filtered = list.filter((c) => {
    const n = c.name?.trim().toLowerCase()
    return n && n !== 'sin categoría' && !exampleNames.includes(n)
  })
  return [DEFAULT_CATEGORY, ...filtered]
}

const CATEGORY_COLORS = [
  { name: 'Naranja', hex: '#F76911' },
  { name: 'Esmeralda', hex: '#10B981' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Púrpura', hex: '#8B5CF6' },
  { name: 'Rosa', hex: '#EC4899' },
  { name: 'Ámbar', hex: '#F59E0B' },
]

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

// Renderizador interactivo de texto con enlaces automáticos detectables
function renderTextWithLinks(text?: string | null) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#F76911] hover:underline inline-flex items-center gap-0.5 font-bold break-all"
        >
          <span>{part.length > 35 ? `${part.slice(0, 32)}...` : part}</span>
          <svg className="w-3 h-3 stroke-current stroke-2 fill-none inline shrink-0" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function TareasPage() {
  const router = useRouter()
  const supabase = createClient()

  const [todos, setTodos] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<TodoCategoryItem[]>(DEFAULT_CATEGORIES)
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [familyId, setFamilyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Filtros y Búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('Todas')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('Todas')
  const [recurrenceFilter, setRecurrenceFilter] = useState<'all' | 'recurring' | 'sporadic'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | TodoPriority>('all')
  const [sortBy, setSortBy] = useState<'manual' | 'priority' | 'due_date' | 'created'>('manual')
  const [showArchived, setShowArchived] = useState(false)

  // Estado del Modal / Bottom Sheet
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'task' | 'categories'>('task')

  // Formulario Tarea
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [title, setTitle] = useState('')
  const [hasDetails, setHasDetails] = useState(false)
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState<string>('Sin categoría')
  const [priority, setPriority] = useState<TodoPriority>('normal')
  const [link, setLink] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [dueDateTime, setDueDateTime] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceDays, setRecurrenceDays] = useState(7)
  const [subtasksDraft, setSubtasksDraft] = useState<SubtaskDraft[]>([])

  // Formulario Categoría (Pestaña Categorías)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#F76911')
  const [savingCategory, setSavingCategory] = useState(false)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const orangeGradient = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

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
      // 0. Cargar integrantes cacheados
      try {
        const cached = localStorage.getItem('casa_family_members')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMembers(parsed)
          }
        }
      } catch {}

      // 0.1 Cargar categorías cacheadas
      try {
        const cachedCats = localStorage.getItem('casa_todo_categories')
        if (cachedCats) {
          const parsed = JSON.parse(cachedCats)
          if (Array.isArray(parsed)) {
            const sanitized = sanitizeCategories(parsed)
            setCategories(sanitized)
            try {
              localStorage.setItem('casa_todo_categories', JSON.stringify(sanitized))
            } catch {}
          }
        }
      } catch {}

      // 1. CARGA INMEDIATA DESDE DEXIE
      let currentFamId = familyId
      try {
        if (!currentFamId) {
          currentFamId = await getOfflineFamilyId()
          if (currentFamId) setFamilyId(currentFamId)
        }

        const stored = currentFamId
          ? await offlineDB.todos.where('family_id').equals(currentFamId).toArray()
          : await offlineDB.todos.toArray()

        try {
          const storedCats = currentFamId
            ? await offlineDB.todo_categories.where('family_id').equals(currentFamId).toArray()
            : await offlineDB.todo_categories.toArray()
          if (storedCats && storedCats.length > 0) {
            const mappedCats = storedCats.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color || '#F76911',
            }))
            const sanitized = sanitizeCategories(mappedCats)
            setCategories(sanitized)
          }
        } catch {}

        if (stored && stored.length > 0) {
          const nowMs = Date.now()
          const reactivatedTodos: TodoItem[] = []

          const localTodos: TodoItem[] = stored.map((t, idx) => {
            const isRec = Boolean(t.is_recurring)
            const interval = t.recurrence_interval_days || 7
            let isDone = t.done || false
            let doneAt = t.done_at
            let dueDate = t.due_date

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
                  details: t.details || null,
                  category: t.category || null,
                  subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
                  priority: (t.priority as TodoPriority) || 'normal',
                  position: t.position ?? idx,
                  archived: Boolean(t.archived),
                  link: t.link || null,
                  reminder_sent: false,
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
              details: t.details || null,
              category: t.category || null,
              subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
              priority: (t.priority as TodoPriority) || 'normal',
              position: t.position ?? idx,
              archived: Boolean(t.archived),
              link: t.link || null,
              reminder_sent: Boolean(t.reminder_sent),
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

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return
      }

      // 2. Obtener family_id remoto
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

      // 3. Cargar integrantes reales
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

      // 4. Cargar Categorías desde Supabase
      try {
        if (currentFamId) {
          const { data: catData } = await supabase
            .from('todo_categories')
            .select('*')
            .eq('family_id', currentFamId)
            .order('name', { ascending: true })

          if (catData && catData.length > 0) {
            const mapped = catData.map((c: any) => ({
              id: c.id,
              name: c.name,
              color: c.color || '#F76911',
            }))
            const sanitized = sanitizeCategories(mapped)
            setCategories(sanitized)
            try {
              localStorage.setItem('casa_todo_categories', JSON.stringify(sanitized))
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Categorías no encontradas o tabla pendiente de migración:', err)
      }

      // 5. Sincronizar tareas con Supabase
      try {
        let todosQuery = supabase
          .from('todos')
          .select('*')
          .order('position', { ascending: true, nullsFirst: false })

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
          unsyncedItems.forEach((it, idx) => {
            mergedMap.set(it.id, {
              id: it.id,
              family_id: it.family_id,
              title: it.title,
              details: it.details || null,
              category: it.category || null,
              subtasks: Array.isArray(it.subtasks) ? it.subtasks : [],
              priority: (it.priority as TodoPriority) || 'normal',
              position: it.position ?? idx,
              archived: Boolean(it.archived),
              link: it.link || null,
              reminder_sent: Boolean(it.reminder_sent),
              assigned_to: it.assigned_to,
              due_date: it.due_date,
              done: it.done,
              done_at: it.done_at,
              is_recurring: it.is_recurring,
              recurrence_interval_days: it.recurrence_interval_days,
              created_at: it.created_at,
            })
          })

          todosRes.forEach((rem: any, idx: number) => {
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
                    details: rem.details || localIt?.details || null,
                    category: rem.category || localIt?.category || null,
                    subtasks: Array.isArray(rem.subtasks) ? rem.subtasks : (localIt?.subtasks || []),
                    priority: rem.priority || localIt?.priority || 'normal',
                    position: rem.position ?? localIt?.position ?? idx,
                    archived: rem.archived !== undefined ? Boolean(rem.archived) : Boolean(localIt?.archived),
                    link: rem.link || localIt?.link || null,
                    reminder_sent: false,
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
                details: rem.details !== undefined ? rem.details : (localIt?.details || null),
                category: rem.category !== undefined ? rem.category : (localIt?.category || null),
                subtasks: Array.isArray(rem.subtasks) ? rem.subtasks : (localIt?.subtasks || []),
                priority: rem.priority || localIt?.priority || 'normal',
                position: rem.position ?? localIt?.position ?? idx,
                archived: rem.archived !== undefined ? Boolean(rem.archived) : Boolean(localIt?.archived),
                link: rem.link || localIt?.link || null,
                reminder_sent: rem.reminder_sent !== undefined ? Boolean(rem.reminder_sent) : Boolean(localIt?.reminder_sent),
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

          const remoteIds = new Set(todosRes.map((rem: any) => rem.id))
          const toDelete = currentLocal
            .filter((rem) => rem._synced && !remoteIds.has(rem.id))
            .map((rem) => rem.id)

          if (toDelete.length > 0) {
            await offlineDB.todos.bulkDelete(toDelete)
          }

          const toPut = mergedList.map((m) => ({
            ...m,
            family_id: m.family_id || currentFamId || '',
            _synced: true,
          }))
          await offlineDB.todos.bulkPut(toPut)
        }
      } catch (err) {
        console.warn('[Offline] Error sincronizando tareas con Supabase:', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    function handleSyncComplete() {
      loadData()
    }
    window.addEventListener('casa-sync-complete', handleSyncComplete)
    window.addEventListener('online', handleSyncComplete)

    // Solicitar permiso de notificaciones de forma no intrusiva si el usuario interactúa
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    return () => {
      window.removeEventListener('casa-sync-complete', handleSyncComplete)
      window.removeEventListener('online', handleSyncComplete)
    }
  }, [])

  useActionParam({ new: openCreate })

  // Check / Uncheck tarea principal
  async function toggleDone(todo: TodoItem) {
    const nextDone = !todo.done
    const nextDoneAt = nextDone ? new Date().toISOString() : null
    const targetFamId = todo.family_id || familyId || (await getOfflineFamilyId())

    const updatedSubtasks = (todo.subtasks || []).map((st) => ({
      ...st,
      done: nextDone ? true : st.done,
      done_at: nextDone ? (st.done_at || nextDoneAt) : st.done_at,
    }))

    const updatedTodo: TodoItem = {
      ...todo,
      done: nextDone,
      done_at: nextDoneAt,
      subtasks: updatedSubtasks,
    }

    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updatedTodo : t)))

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
          details: todo.details || null,
          category: todo.category || null,
          subtasks: updatedSubtasks,
          priority: todo.priority || 'normal',
          position: todo.position ?? 0,
          archived: Boolean(todo.archived),
          link: todo.link || null,
          reminder_sent: todo.reminder_sent ?? false,
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

  // Check / Uncheck subtarea individual
  async function toggleSubtaskDone(todo: TodoItem, subtaskId: string) {
    const targetFamId = todo.family_id || familyId || (await getOfflineFamilyId())
    const currentSubtasks = todo.subtasks || []

    const nextSubtasks = currentSubtasks.map((st) => {
      if (st.id === subtaskId) {
        const nextDone = !st.done
        return {
          ...st,
          done: nextDone,
          done_at: nextDone ? new Date().toISOString() : null,
        }
      }
      return st
    })

    const updatedTodo: TodoItem = {
      ...todo,
      subtasks: nextSubtasks,
    }

    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updatedTodo : t)))

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
          details: todo.details || null,
          category: todo.category || null,
          subtasks: nextSubtasks,
          priority: todo.priority || 'normal',
          position: todo.position ?? 0,
          archived: Boolean(todo.archived),
          link: todo.link || null,
          reminder_sent: todo.reminder_sent ?? false,
          assigned_to: todo.assigned_to,
          due_date: todo.due_date,
          done: todo.done,
          done_at: todo.done_at,
          is_recurring: todo.is_recurring ?? false,
          recurrence_interval_days: todo.recurrence_interval_days ?? null,
        },
      })
    } catch (e) {
      console.warn('[Offline] Error mutando subtarea localmente:', e)
    }
  }

  // Reordenar tarea (mover arriba o abajo manualmente)
  async function moveTask(taskId: string, direction: -1 | 1) {
    const list = [...displayedPending]
    const index = list.findIndex((t) => t.id === taskId)
    if (index === -1) return

    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= list.length) return

    const currentTask = list[index]
    const neighborTask = list[targetIndex]

    const tempPos = currentTask.position ?? index
    const neighborPos = neighborTask.position ?? targetIndex

    const newCurrentPos = neighborPos
    const newNeighborPos = tempPos === neighborPos ? tempPos + direction : tempPos

    const updatedTodos = todos.map((t) => {
      if (t.id === currentTask.id) return { ...t, position: newCurrentPos }
      if (t.id === neighborTask.id) return { ...t, position: newNeighborPos }
      return t
    })

    setTodos(updatedTodos)

    const targetFamId = currentTask.family_id || familyId || (await getOfflineFamilyId())

    try {
      await Promise.all([
        mutate({
          familyId: targetFamId,
          entity: 'todos',
          action: 'UPDATE',
          entityId: currentTask.id,
          payload: { ...currentTask, position: newCurrentPos },
        }),
        mutate({
          familyId: targetFamId,
          entity: 'todos',
          action: 'UPDATE',
          entityId: neighborTask.id,
          payload: { ...neighborTask, position: newNeighborPos },
        }),
      ])
    } catch {}
  }

  // Archivar una tarea completada
  async function toggleArchiveTask(todo: TodoItem) {
    const nextArchived = !todo.archived
    const targetFamId = todo.family_id || familyId || (await getOfflineFamilyId())

    const updatedTodo = { ...todo, archived: nextArchived }
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? updatedTodo : t)))

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
          details: todo.details || null,
          category: todo.category || null,
          subtasks: todo.subtasks || [],
          priority: todo.priority || 'normal',
          position: todo.position ?? 0,
          archived: nextArchived,
          link: todo.link || null,
          reminder_sent: todo.reminder_sent ?? false,
          assigned_to: todo.assigned_to,
          due_date: todo.due_date,
          done: todo.done,
          done_at: todo.done_at,
          is_recurring: todo.is_recurring ?? false,
          recurrence_interval_days: todo.recurrence_interval_days ?? null,
        },
      })
    } catch {}
  }

  // Archivar todas las tareas completadas visibles
  async function archiveAllCompleted() {
    const toArchive = completedTodos.filter((t) => !t.archived)
    if (toArchive.length === 0) return

    if (!confirm(`¿Archivar ${toArchive.length} tareas completadas para limpiar la pantalla?`)) return

    const targetFamId = familyId || (await getOfflineFamilyId())
    const archivedIds = new Set(toArchive.map((t) => t.id))

    setTodos((prev) =>
      prev.map((t) => (archivedIds.has(t.id) ? { ...t, archived: true } : t))
    )

    try {
      await Promise.all(
        toArchive.map((t) =>
          mutate({
            familyId: targetFamId,
            entity: 'todos',
            action: 'UPDATE',
            entityId: t.id,
            payload: { ...t, archived: true },
          })
        )
      )
    } catch {}
  }

  // Apertura Bottom Sheet
  function openCreate() {
    setEditingTodo(null)
    setTitle('')
    setHasDetails(false)
    setDetails('')
    setCategory('Sin categoría')
    setPriority('normal')
    setLink('')
    setSelectedMembers([])
    setDueDateTime('')
    setIsRecurring(false)
    setRecurrenceDays(7)
    setSubtasksDraft([])
    setActiveTab('task')
    setIsSheetOpen(true)
  }

  function openEdit(todo: TodoItem) {
    setEditingTodo(todo)
    setTitle(todo.title || '')
    setHasDetails(Boolean(todo.details && todo.details.trim()))
    setDetails(todo.details || '')
    setCategory(todo.category || 'Sin categoría')
    setPriority((todo.priority as TodoPriority) || 'normal')
    setLink(todo.link || '')
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

    const drafts: SubtaskDraft[] = (todo.subtasks || []).map((st) => ({
      id: st.id,
      title: st.title,
      details: st.details || '',
      due_date: toDateTimeLocalValue(st.due_date),
      done: st.done || false,
      showDetails: Boolean(st.details && st.details.trim()),
      showReminder: Boolean(st.due_date),
    }))
    setSubtasksDraft(drafts)

    setActiveTab('task')
    setIsSheetOpen(true)
  }

  function addSubtaskDraft() {
    setSubtasksDraft((prev) => [
      ...prev,
      {
        id: safeUUID(),
        title: '',
        details: '',
        due_date: '',
        done: false,
        showDetails: false,
        showReminder: false,
      },
    ])
  }

  function removeSubtaskDraft(id: string) {
    setSubtasksDraft((prev) => prev.filter((st) => st.id !== id))
  }

  function updateSubtaskField(id: string, field: keyof SubtaskDraft, value: any) {
    setSubtasksDraft((prev) =>
      prev.map((st) => (st.id === id ? { ...st, [field]: value } : st))
    )
  }

  function toggleMemberSelection(name: string) {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    )
  }

  function selectAllMembers() {
    setSelectedMembers(allAvailableMembers)
  }

  function clearSelectedMembers() {
    setSelectedMembers([])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)

    const targetFamilyId = familyId || (await getOfflineFamilyId())
    const tempId = editingTodo?.id || safeUUID()

    const assignedToString = selectedMembers.length > 0 ? selectedMembers.join(', ') : null

    const validSubtasks: TodoSubtask[] = subtasksDraft
      .filter((st) => st.title.trim())
      .map((st) => ({
        id: st.id,
        title: st.title.trim(),
        details: st.showDetails && st.details.trim() ? st.details.trim() : null,
        due_date: st.showReminder && st.due_date ? new Date(st.due_date).toISOString() : null,
        done: st.done,
        done_at: st.done ? new Date().toISOString() : null,
      }))

    const calculatedDueDate = dueDateTime ? new Date(dueDateTime).toISOString() : null
    const dueDateChanged = Boolean(editingTodo && editingTodo.due_date !== calculatedDueDate)
    const reminderSent = dueDateChanged ? false : (editingTodo?.reminder_sent ?? false)

    const payload: TodoItem = {
      id: tempId,
      family_id: targetFamilyId,
      title: title.trim(),
      details: hasDetails && details.trim() ? details.trim() : null,
      category: category && category !== 'Sin categoría' ? category : null,
      subtasks: validSubtasks,
      priority: priority || 'normal',
      position: editingTodo?.position ?? todos.length,
      archived: editingTodo?.archived ?? false,
      link: link.trim() || null,
      reminder_sent: reminderSent,
      assigned_to: assignedToString,
      due_date: calculatedDueDate,
      done: editingTodo ? editingTodo.done : false,
      done_at: editingTodo ? editingTodo.done_at : null,
      is_recurring: isRecurring,
      recurrence_interval_days: isRecurring ? (recurrenceDays || 7) : null,
      created_at: editingTodo?.created_at || new Date().toISOString(),
    }

    setTodos((prev) => {
      if (editingTodo) {
        return prev.map((t) => (t.id === editingTodo.id ? payload : t))
      } else {
        return [payload, ...prev]
      }
    })

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
          details: payload.details,
          category: payload.category,
          subtasks: payload.subtasks,
          priority: payload.priority,
          position: payload.position,
          archived: payload.archived,
          link: payload.link,
          reminder_sent: payload.reminder_sent,
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
    setDetails('')
    setHasDetails(false)
    setDueDateTime('')
    setLink('')
    setPriority('normal')
    setSelectedMembers([])
    setIsRecurring(false)
    setRecurrenceDays(7)
    setSubtasksDraft([])
    setSaving(false)
  }

  async function handleDelete() {
    if (!editingTodo) return
    if (!confirm('¿Eliminar esta tarea definitivamente?')) return
    setDeleting(true)

    const targetId = editingTodo.id
    const targetFamId = editingTodo.family_id || familyId || (await getOfflineFamilyId())

    setTodos((prev) => prev.filter((t) => t.id !== targetId))

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

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newCatName.trim()
    if (!trimmed) return

    if (trimmed.toLowerCase() === 'sin categoría') {
      alert('La categoría "Sin categoría" ya viene por defecto.')
      return
    }

    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      alert('Ya existe una categoría con este nombre.')
      return
    }

    setSavingCategory(true)
    const newCatId = safeUUID()
    const targetFamId = familyId || (await getOfflineFamilyId())

    const newCat: TodoCategoryItem = {
      id: newCatId,
      name: trimmed,
      color: newCatColor,
    }

    const updated = [...categories, newCat]
    setCategories(updated)
    setCategory(trimmed)
    setNewCatName('')

    try {
      localStorage.setItem('casa_todo_categories', JSON.stringify(updated))
    } catch {}

    try {
      await offlineDB.todo_categories.put({
        id: newCatId,
        family_id: targetFamId,
        name: trimmed,
        color: newCatColor,
        created_at: new Date().toISOString(),
        _synced: false,
      })
    } catch {}

    try {
      await mutate({
        familyId: targetFamId,
        entity: 'todo_categories',
        action: 'INSERT',
        entityId: newCatId,
        payload: {
          id: newCatId,
          family_id: targetFamId,
          name: trimmed,
          color: newCatColor,
        },
      })
    } catch (err) {
      console.warn('Categoría guardada localmente:', err)
    }

    setSavingCategory(false)
  }

  async function handleDeleteCategory(catId: string, catName: string) {
    if (catName.toLowerCase() === 'sin categoría' || catId === 'default-sin-categoria') {
      alert('La categoría "Sin categoría" es la predeterminada del sistema y no se puede eliminar.')
      return
    }

    if (!confirm(`¿Eliminar la categoría "${catName}"? Las tareas asociadas mantendrán su nombre de categoría.`)) {
      return
    }

    const targetFamId = familyId || (await getOfflineFamilyId())
    const updated = categories.filter((c) => c.id !== catId)
    setCategories(updated)

    if (category === catName) {
      setCategory('Sin categoría')
    }
    if (selectedCategoryFilter === catName) {
      setSelectedCategoryFilter('Todas')
    }

    try {
      localStorage.setItem('casa_todo_categories', JSON.stringify(updated))
    } catch {}

    try {
      await offlineDB.todo_categories.delete(catId)
    } catch {}

    if (isValidUUID(catId)) {
      try {
        await mutate({
          familyId: targetFamId,
          entity: 'todo_categories',
          action: 'DELETE',
          entityId: catId,
        })
      } catch {}
    }
  }

  function matchesMember(todo: TodoItem, filter: string) {
    if (filter === 'Todas') return true
    if (filter === 'Sin asignar') return !todo.assigned_to || todo.assigned_to.trim() === ''
    if (!todo.assigned_to) return false
    const assignedList = todo.assigned_to
      .split(',')
      .map((s) => s.trim().toLowerCase())
    return assignedList.includes(filter.toLowerCase())
  }

  function matchesCategory(todo: TodoItem, filter: string) {
    if (filter === 'Todas') return true
    if (filter === 'Sin categoría') {
      return !todo.category || todo.category.trim() === '' || todo.category.toLowerCase() === 'sin categoría'
    }
    return (todo.category || 'Sin categoría').toLowerCase() === filter.toLowerCase()
  }

  function matchesRecurrence(todo: TodoItem, filter: 'all' | 'recurring' | 'sporadic') {
    if (filter === 'all') return true
    if (filter === 'recurring') return Boolean(todo.is_recurring)
    if (filter === 'sporadic') return !todo.is_recurring
    return true
  }

  function matchesPriority(todo: TodoItem, filter: 'all' | TodoPriority) {
    if (filter === 'all') return true
    return (todo.priority || 'normal') === filter
  }

  function matchesSearch(todo: TodoItem): boolean {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    if (todo.title.toLowerCase().includes(q)) return true
    if (todo.details?.toLowerCase().includes(q)) return true
    if (todo.link?.toLowerCase().includes(q)) return true
    if (todo.assigned_to?.toLowerCase().includes(q)) return true
    if (todo.category?.toLowerCase().includes(q)) return true
    if (
      todo.subtasks?.some(
        (st) => st.title.toLowerCase().includes(q) || st.details?.toLowerCase().includes(q)
      )
    ) {
      return true
    }
    return false
  }

  const pendingTodos = todos.filter((t) => !t.done)
  const completedTodos = todos.filter((t) => t.done)
  const activeCompletedTodos = completedTodos.filter((t) => (showArchived ? t.archived : !t.archived))
  const archivedCount = completedTodos.filter((t) => t.archived).length

  const recurringCount = todos.filter((t) => t.is_recurring).length
  const sporadicCount = todos.filter((t) => !t.is_recurring).length
  const urgentCount = todos.filter((t) => !t.done && t.priority === 'alta').length

  // Función de ordenamiento
  function sortTodos(a: TodoItem, b: TodoItem) {
    if (sortBy === 'priority') {
      const weights: Record<string, number> = { alta: 3, media: 2, normal: 1 }
      const diff = (weights[b.priority || 'normal'] || 1) - (weights[a.priority || 'normal'] || 1)
      if (diff !== 0) return diff
      return (a.position ?? 0) - (b.position ?? 0)
    }
    if (sortBy === 'due_date') {
      if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      if (a.due_date) return -1
      if (b.due_date) return 1
      return (a.position ?? 0) - (b.position ?? 0)
    }
    if (sortBy === 'created') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    }
    // Orden manual por defecto
    return (a.position ?? 0) - (b.position ?? 0)
  }

  const displayedPending = useMemo(() => {
    return pendingTodos
      .filter(
        (t) =>
          matchesMember(t, selectedMemberFilter) &&
          matchesCategory(t, selectedCategoryFilter) &&
          matchesRecurrence(t, recurrenceFilter) &&
          matchesPriority(t, priorityFilter) &&
          matchesSearch(t)
      )
      .sort(sortTodos)
  }, [pendingTodos, selectedMemberFilter, selectedCategoryFilter, recurrenceFilter, priorityFilter, searchQuery, sortBy])

  const displayedCompleted = useMemo(() => {
    return activeCompletedTodos
      .filter(
        (t) =>
          matchesMember(t, selectedMemberFilter) &&
          matchesCategory(t, selectedCategoryFilter) &&
          matchesRecurrence(t, recurrenceFilter) &&
          matchesPriority(t, priorityFilter) &&
          matchesSearch(t)
      )
      .sort((a, b) => new Date(b.done_at || 0).getTime() - new Date(a.done_at || 0).getTime())
  }, [activeCompletedTodos, selectedMemberFilter, selectedCategoryFilter, recurrenceFilter, priorityFilter, searchQuery])

  // Integrantes únicos para los chips de filtro
  const filterMembers = Array.from(
    new Set([
      'Todas',
      ...members.map((m) => m.name),
      ...todos.flatMap((t) =>
        t.assigned_to ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean) : []
      ),
    ])
  )

  const allAvailableMembers = Array.from(
    new Set([
      ...members.map((m) => m.name),
      ...selectedMembers,
    ])
  )

  const filterCategories = Array.from(
    new Set([
      'Todas',
      'Sin categoría',
      ...categories.map((c) => c.name),
      ...todos.map((t) => t.category).filter(Boolean) as string[],
    ])
  ).filter((cat) => {
    const n = cat.toLowerCase()
    return n !== 'tareas de la casa' && n !== 'tareas personales' && n !== 'tareas financieras'
  })

  function getCategoryColor(catName?: string | null): string {
    if (!catName || catName.toLowerCase() === 'sin categoría') return '#737373'
    const found = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase())
    return found?.color || '#F76911'
  }

  const hasActiveFilters = Boolean(
    selectedMemberFilter !== 'Todas' ||
    selectedCategoryFilter !== 'Todas' ||
    priorityFilter !== 'all' ||
    recurrenceFilter !== 'all' ||
    searchQuery.trim() !== ''
  )

  const activeFiltersCount =
    (selectedMemberFilter !== 'Todas' ? 1 : 0) +
    (selectedCategoryFilter !== 'Todas' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (recurrenceFilter !== 'all' ? 1 : 0) +
    (searchQuery.trim() !== '' ? 1 : 0)

  const clearAllFilters = () => {
    setSelectedMemberFilter('Todas')
    setSelectedCategoryFilter('Todas')
    setPriorityFilter('all')
    setRecurrenceFilter('all')
    setSearchQuery('')
  }

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white m-0">
              Tareas del Hogar
            </h1>
            {urgentCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-950 border border-red-800/80 text-red-300 text-[10px] font-black animate-pulse">
                🔴 {urgentCount} {urgentCount === 1 ? 'urgente' : 'urgentes'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />
          <NotificationBell />
        </div>
      </header>

      {/* BARRA SUPERIOR: BUSCADOR EN TIEMPO REAL */}
      <div className="relative w-full">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar tareas, notas, subtareas o enlaces..."
          className="w-full bg-[#161616] border border-neutral-800/90 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911] shadow-inner"
        />
        <svg
          className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3 stroke-current stroke-2 fill-none"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 hover:text-white absolute right-3 top-2 flex items-center justify-center text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* BARRA DE ESTADO, ALCANCE Y FILTROS */}
      <div className="flex flex-col gap-3 bg-[#181818] p-3.5 sm:p-4 rounded-[26px] border border-neutral-800/80 shadow-md">
        {/* FILA 1: ESTADO RESUMIDO Y SEGMENTED CONTROL (ALCANCE) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#121212] border border-neutral-800 text-xs font-bold text-neutral-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{displayedPending.length} pendientes</span>
              <span className="text-neutral-500 font-medium">de {todos.length}</span>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-2.5 py-1 rounded-full bg-[#F76911]/15 hover:bg-[#F76911]/25 border border-[#F76911]/40 text-[#F76911] text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                title="Restablecer todos los filtros"
              >
                <span>✕</span>
                <span>Limpiar filtros ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* SEGMENTED TABS: TODAS / PUNTUALES / RECURRENTES */}
          <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-2xl border border-neutral-800/80 overflow-x-auto scrollbar-none self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setRecurrenceFilter('all')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                recurrenceFilter === 'all'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todas ({todos.length})
            </button>
            <button
              type="button"
              onClick={() => setRecurrenceFilter('sporadic')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                recurrenceFilter === 'sporadic'
                  ? 'bg-[#F76911] text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>📌</span>
              <span>Puntuales ({sporadicCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setRecurrenceFilter('recurring')}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                recurrenceFilter === 'recurring'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span>🔄</span>
              <span>Recurrentes ({recurringCount})</span>
            </button>
          </div>
        </div>

        {/* FILA 2: SELECTS INTELIGENTES COMPACTOS */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-neutral-800/60 pb-0.5 scrollbar-none sm:flex-wrap">
          {/* SELECT ASIGNADA A */}
          <div
            className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              selectedMemberFilter !== 'Todas'
                ? 'bg-[#F76911]/15 border-[#F76911]/60 text-white shadow-xs'
                : 'bg-[#121212] border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
            }`}
          >
            <span className="pointer-events-none flex items-center gap-1.5">
              <span>👤</span>
              <span className="max-w-[120px] truncate">
                {selectedMemberFilter === 'Todas' ? 'Asignada' : selectedMemberFilter}
              </span>
            </span>

            {selectedMemberFilter !== 'Todas' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedMemberFilter('Todas')
                }}
                className="relative z-10 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                title="Quitar filtro de asignada"
              >
                ✕
              </button>
            ) : (
              <svg className="w-3.5 h-3.5 text-neutral-500 pointer-events-none stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}

            <select
              value={selectedMemberFilter}
              onChange={(e) => setSelectedMemberFilter(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0 text-xs"
              title="Filtrar por integrante"
            >
              {filterMembers.map((m) => (
                <option key={m} value={m} className="bg-[#1a1a1a] text-white">
                  {m === 'Todas' ? '👤 Todos los integrantes' : `👤 ${m}`}
                </option>
              ))}
            </select>
          </div>

          {/* SELECT CATEGORÍA */}
          {(() => {
            const isCatActive = selectedCategoryFilter !== 'Todas'
            const catColor = isCatActive ? getCategoryColor(selectedCategoryFilter) : undefined
            return (
              <div
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  isCatActive
                    ? 'text-white shadow-xs'
                    : 'bg-[#121212] border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                }`}
                style={
                  isCatActive
                    ? { backgroundColor: `${catColor}25`, borderColor: `${catColor}80` }
                    : undefined
                }
              >
                <span className="pointer-events-none flex items-center gap-1.5">
                  {isCatActive ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: catColor }}
                    />
                  ) : (
                    <span>🏷️</span>
                  )}
                  <span className="max-w-[120px] truncate">
                    {selectedCategoryFilter === 'Todas' ? 'Categoría' : selectedCategoryFilter}
                  </span>
                </span>

                {isCatActive ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setSelectedCategoryFilter('Todas')
                    }}
                    className="relative z-10 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                    title="Quitar filtro de categoría"
                  >
                    ✕
                  </button>
                ) : (
                  <svg className="w-3.5 h-3.5 text-neutral-500 pointer-events-none stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}

                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0 text-xs"
                  title="Filtrar por categoría"
                >
                  {filterCategories.map((c) => (
                    <option key={c} value={c} className="bg-[#1a1a1a] text-white">
                      {c === 'Todas' ? '🏷️ Todas las categorías' : `🏷️ ${c}`}
                    </option>
                  ))}
                </select>
              </div>
            )
          })()}

          {/* SELECT PRIORIDAD */}
          {(() => {
            const isPriorityActive = priorityFilter !== 'all'
            const priorityLabels: Record<string, string> = {
              all: 'Prioridad',
              alta: '🔴 Alta',
              media: '🟡 Media',
              normal: '🟢 Normal',
            }
            return (
              <div
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  isPriorityActive
                    ? priorityFilter === 'alta'
                      ? 'bg-red-950/40 border-red-800/80 text-red-200'
                      : priorityFilter === 'media'
                      ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                      : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                    : 'bg-[#121212] border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span className="pointer-events-none flex items-center gap-1.5">
                  {!isPriorityActive && <span>⚡</span>}
                  <span>{priorityLabels[priorityFilter] || 'Prioridad'}</span>
                </span>

                {isPriorityActive ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setPriorityFilter('all')
                    }}
                    className="relative z-10 w-4 h-4 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors"
                    title="Quitar filtro de prioridad"
                  >
                    ✕
                  </button>
                ) : (
                  <svg className="w-3.5 h-3.5 text-neutral-500 pointer-events-none stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                )}

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0 text-xs"
                  title="Filtrar por prioridad"
                >
                  <option value="all" className="bg-[#1a1a1a] text-white">⚡ Todas las prioridades</option>
                  <option value="alta" className="bg-[#1a1a1a] text-white">🔴 Alta / Urgente</option>
                  <option value="media" className="bg-[#1a1a1a] text-white">🟡 Media</option>
                  <option value="normal" className="bg-[#1a1a1a] text-white">🟢 Normal</option>
                </select>
              </div>
            )
          })()}

          {/* SELECT ORDENAMIENTO */}
          {(() => {
            const sortLabels: Record<string, string> = {
              manual: '↕️ Mi orden',
              priority: '🔴 Prioridad',
              due_date: '⏰ Fecha límite',
              created: '🆕 Recientes',
            }
            return (
              <div className="relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-800 bg-[#121212] text-xs font-bold text-neutral-300 hover:border-neutral-700 hover:text-white transition-all">
                <span className="pointer-events-none flex items-center gap-1.5">
                  <span>{sortLabels[sortBy] || '↕️ Ordenar'}</span>
                </span>
                <svg className="w-3.5 h-3.5 text-neutral-500 pointer-events-none stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0 text-xs"
                  title="Criterio de ordenación"
                >
                  <option value="manual" className="bg-[#1a1a1a] text-white">↕️ Mi orden manual</option>
                  <option value="priority" className="bg-[#1a1a1a] text-white">🔴 Prioridad (urgentes primero)</option>
                  <option value="due_date" className="bg-[#1a1a1a] text-white">⏰ Fecha límite (próximas)</option>
                  <option value="created" className="bg-[#1a1a1a] text-white">🆕 Recientes (últimas creadas)</option>
                </select>
              </div>
            )
          })()}
        </div>
      </div>

      {/* GRID RESPONSIVO: PENDIENTES Y COMPLETADAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* COLUMNA PENDIENTES */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-300 m-0">
              Pendientes ({displayedPending.length})
            </h2>
            {sortBy === 'manual' && displayedPending.length > 1 && (
              <span className="text-[10px] text-neutral-500 font-medium">
                Tip: Usa ▲ / ▼ para organizar tus tareas
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80">
                Cargando tareas...
              </div>
            ) : displayedPending.length === 0 ? (
              <div className="p-8 text-center bg-[#1a1a1a] rounded-[28px] border border-neutral-800/80 flex flex-col items-center">
                <p className="text-sm font-bold text-neutral-300 m-0">No hay tareas pendientes</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                  {searchQuery
                    ? `No se encontraron coincidencias para "${searchQuery}".`
                    : !hasActiveFilters
                    ? '¡Todo al día en la casa!'
                    : `No hay tareas pendientes con los filtros aplicados.`}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-3 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-neutral-200 transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <span>✕</span>
                    <span>Quitar todos los filtros</span>
                  </button>
                )}
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
              displayedPending.map((t, idx) => {
                const formattedDate = formatDateTime(t.due_date)
                const isOverdue = isTaskOverdue(t.due_date)
                const assignedList = t.assigned_to
                  ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean)
                  : []
                const catColor = getCategoryColor(t.category)
                const subtasksList = t.subtasks || []
                const completedSubtasks = subtasksList.filter((s) => s.done).length

                return (
                  <article
                    key={t.id}
                    className={`p-4 rounded-[24px] bg-[#1a1a1a] border shadow-md transition-all flex flex-col gap-2.5 ${
                      t.priority === 'alta'
                        ? 'border-red-800/80 bg-gradient-to-r from-red-950/30 to-[#1a1a1a]'
                        : isOverdue
                        ? 'border-red-900/60 hover:border-red-700/80 bg-gradient-to-r from-red-950/20 to-[#1a1a1a]'
                        : 'border-neutral-800/80 hover:border-neutral-700'
                    }`}
                  >
                    {/* ENCABEZADO: CHECKBOX PRINCIPAL + BOTONES REORDENAR + TÍTULO + EDITAR */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* CHECK A LA IZQUIERDA DEL TODO */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleDone(t)
                          }}
                          className="mt-0.5 w-6 h-6 rounded-full border-2 border-neutral-500 hover:border-[#F76911] hover:scale-110 active:scale-95 flex items-center justify-center shrink-0 cursor-pointer transition-all bg-transparent group"
                          title="Marcar tarea como completada"
                        >
                          <svg
                            className="w-3.5 h-3.5 stroke-white stroke-[3] fill-none opacity-0 group-hover:opacity-40 transition-opacity"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>

                        {/* BOTONES DE REORDENAMIENTO MANUAL (▲ / ▼) */}
                        {sortBy === 'manual' && displayedPending.length > 1 && (
                          <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 pt-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveTask(t.id, -1)}
                              className="w-5 h-5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 disabled:opacity-20 flex items-center justify-center text-neutral-300 text-[10px] cursor-pointer"
                              title="Mover arriba"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              disabled={idx === displayedPending.length - 1}
                              onClick={() => moveTask(t.id, 1)}
                              className="w-5 h-5 rounded-md bg-neutral-800/70 hover:bg-neutral-700 disabled:opacity-20 flex items-center justify-center text-neutral-300 text-[10px] cursor-pointer"
                              title="Mover abajo"
                            >
                              ▼
                            </button>
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          {/* BADGES: PRIORIDAD, CATEGORÍA, RECURRENCIA, INTEGRANTES, VENCIDA */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {/* BADGE DE PRIORIDAD */}
                            {t.priority === 'alta' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 text-[10px] font-black uppercase tracking-wider shadow-sm">
                                <span>🔴</span>
                                <span>Alta / Urgente</span>
                              </span>
                            )}
                            {t.priority === 'media' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/70 text-[10px] font-bold">
                                <span>🟡</span>
                                <span>Media</span>
                              </span>
                            )}

                            {t.category && t.category.toLowerCase() !== 'sin categoría' && (
                              <span
                                style={{ borderColor: `${catColor}55`, color: catColor }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#131313] border text-[10px] font-bold"
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: catColor }}
                                />
                                <span>{t.category}</span>
                              </span>
                            )}

                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-950/90 text-red-400 border border-red-800/80 text-[10px] font-black uppercase tracking-wider">
                                <span>⚠️</span>
                                <span>Vencida</span>
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F76911]/15 text-[#F76911] border border-[#F76911]/30 text-[10px] font-bold"
                              >
                                <span>👤</span>
                                <span>{person}</span>
                              </span>
                            ))}

                            {subtasksList.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/60 text-[10px] font-medium">
                                <span>📋</span>
                                <span>
                                  {completedSubtasks}/{subtasksList.length}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* TÍTULO PRINCIPAL */}
                          <h3
                            onClick={() => openEdit(t)}
                            className="text-base font-bold text-white hover:text-[#F76911] transition-colors cursor-pointer m-0 leading-tight"
                          >
                            {t.title}
                          </h3>

                          {/* DETALLE CON ENLACES CLICKEABLES */}
                          {t.details && (
                            <div className="flex items-start gap-1.5 mt-1 text-xs text-neutral-300/90">
                              <svg
                                className="w-3.5 h-3.5 mt-0.5 text-neutral-400 shrink-0 stroke-current stroke-2 fill-none"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                              </svg>
                              <div className="whitespace-pre-wrap leading-relaxed">
                                {renderTextWithLinks(t.details)}
                              </div>
                            </div>
                          )}

                          {/* ENLACE DIRECTO RELACIONADO */}
                          {t.link && (
                            <div className="mt-1.5">
                              <a
                                href={t.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1d1a15] border border-[#F76911]/40 text-[#F76911] text-xs font-bold hover:bg-[#F76911]/20 transition-colors"
                              >
                                <span>🔗</span>
                                <span className="truncate max-w-[200px]">{t.link}</span>
                                <svg className="w-3 h-3 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            </div>
                          )}

                          {/* RECORDATORIO / FECHA LÍMITE */}
                          {formattedDate && (
                            <p
                              className={`text-[11px] mt-1.5 flex items-center gap-1 font-medium m-0 ${
                                isOverdue ? 'text-red-400 font-bold' : 'text-neutral-400'
                              }`}
                            >
                              <span>⏰ Límite: {formattedDate}</span>
                              {isOverdue && <span className="font-bold">• Venció</span>}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="px-2.5 py-1.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/50 text-[#F76911] text-xs font-bold transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                      >
                        Editar
                      </button>
                    </div>

                    {/* SUBTAREAS CHECKLIST */}
                    {subtasksList.length > 0 && (
                      <div className="ml-3 sm:ml-4 pl-3 border-l-2 border-neutral-800/80 flex flex-col gap-2 pt-1">
                        {subtasksList.map((st) => {
                          const subtaskOverdue = isTaskOverdue(st.due_date)
                          const subtaskDate = formatDateTime(st.due_date)

                          return (
                            <div key={st.id} className="flex flex-col gap-0.5">
                              <div className="flex items-start gap-2.5 group">
                                <button
                                  type="button"
                                  onClick={() => toggleSubtaskDone(t, st.id)}
                                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                    st.done
                                      ? 'bg-[#F76911] border-[#F76911] text-white shadow-xs'
                                      : 'border-neutral-500 hover:border-[#F76911] bg-transparent'
                                  }`}
                                  title={st.done ? 'Marcar como pendiente' : 'Completar subtarea'}
                                >
                                  {st.done && (
                                    <svg
                                      className="w-2.5 h-2.5 stroke-current stroke-[3] fill-none"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      onClick={() => toggleSubtaskDone(t, st.id)}
                                      className={`text-xs font-semibold cursor-pointer transition-colors ${
                                        st.done ? 'line-through text-neutral-500' : 'text-neutral-200'
                                      }`}
                                    >
                                      {st.title}
                                    </span>

                                    {subtaskDate && (
                                      <span
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-medium ${
                                          subtaskOverdue
                                            ? 'bg-red-950/80 text-red-400 border border-red-800/60 font-bold'
                                            : 'bg-neutral-800/80 text-neutral-400'
                                        }`}
                                      >
                                        <span>⏰</span>
                                        <span>{subtaskDate}</span>
                                      </span>
                                    )}
                                  </div>

                                  {st.details && (
                                    <div className="flex items-start gap-1.5 mt-0.5 text-[11px] text-neutral-400">
                                      <svg
                                        className="w-3 h-3 mt-0.5 text-neutral-500 shrink-0 stroke-current stroke-2 fill-none"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" />
                                      </svg>
                                      <div className="whitespace-pre-wrap">{renderTextWithLinks(st.details)}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </div>
        </section>

        {/* COLUMNA COMPLETADAS & ARCHIVADAS */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-neutral-400 m-0">
              {showArchived ? 'Archivadas' : 'Completadas'} ({displayedCompleted.length})
            </h2>

            <div className="flex items-center gap-2">
              {!showArchived && completedTodos.filter((t) => !t.archived).length > 0 && (
                <button
                  type="button"
                  onClick={archiveAllCompleted}
                  className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                  title="Archivar todas las tareas completadas"
                >
                  <span>🧹</span>
                  <span>Archivar todas</span>
                </button>
              )}

              {archivedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived(!showArchived)}
                  className="px-2.5 py-1 rounded-xl bg-[#141414] border border-neutral-800 hover:text-white text-neutral-400 text-[10px] font-bold cursor-pointer transition-colors"
                >
                  {showArchived ? 'Ver completadas activas' : `📦 Ver archivadas (${archivedCount})`}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {displayedCompleted.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-600 bg-[#151515] rounded-[28px] border border-neutral-800/40">
                {showArchived
                  ? 'No hay tareas archivadas.'
                  : 'Aún no has completado tareas familiares.'}
              </div>
            ) : (
              displayedCompleted.map((t) => {
                const assignedList = t.assigned_to
                  ? t.assigned_to.split(',').map((s) => s.trim()).filter(Boolean)
                  : []
                const recurrenceStatus = t.is_recurring ? getCompletedRecurrenceStatus(t) : null
                const subtasksList = t.subtasks || []

                return (
                  <article
                    key={t.id}
                    className="p-4 rounded-[24px] bg-[#151515] border border-neutral-800/40 opacity-75 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleDone(t)}
                          style={orangeGradient}
                          className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-xs cursor-pointer hover:scale-110 active:scale-90 transition-all shrink-0"
                          title="Marcar como pendiente"
                        >
                          <svg className="w-3.5 h-3.5 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {t.category && (
                              <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded-full border border-neutral-700/40">
                                🏷️ {t.category}
                              </span>
                            )}
                            {t.archived && (
                              <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800/60 px-2 py-0.5 rounded-full border border-neutral-700/30">
                                📦 Archivada
                              </span>
                            )}
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

                          <h3 className="text-sm font-bold text-neutral-400 line-through truncate m-0">
                            {t.title}
                          </h3>

                          {t.details && (
                            <p className="text-xs text-neutral-500 m-0 mt-0.5 line-through">
                              {t.details}
                            </p>
                          )}

                          {assignedList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
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
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleArchiveTask(t)}
                          className="px-2 py-1 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-700/30 text-neutral-400 text-xs font-bold transition-all cursor-pointer"
                          title={t.archived ? 'Desarchivar' : 'Archivar'}
                        >
                          {t.archived ? 'Desarchivar' : '📦 Archivar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="px-2.5 py-1 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-700/30 text-neutral-400 text-xs font-bold transition-all cursor-pointer"
                        >
                          Editar
                        </button>
                      </div>
                    </div>

                    {subtasksList.length > 0 && (
                      <div className="ml-4 pl-3 border-l border-neutral-800/60 flex flex-col gap-1 pt-1">
                        {subtasksList.map((st) => (
                          <div key={st.id} className="flex items-center gap-2 text-xs text-neutral-500 line-through">
                            <span>✓</span>
                            <span>{st.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
            className="relative w-full max-w-xl bg-[#1a1a1a] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl flex flex-col gap-4 max-h-[92vh] overflow-y-auto mb-20 sm:mb-0"
          >
            {/* ENCABEZADO Y TABS */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('task')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'task'
                      ? 'bg-[#F76911] text-white shadow-md'
                      : 'bg-[#141414] text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  <span>📝</span>
                  <span>{editingTodo ? 'Editar Tarea' : 'Nueva Tarea'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('categories')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'categories'
                      ? 'bg-[#F76911] text-white shadow-md'
                      : 'bg-[#141414] text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  <span>🏷️</span>
                  <span>Categorías ({categories.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* TAB 1: FORMULARIO DE TAREA */}
            {activeTab === 'task' && (
              <form onSubmit={handleSave} className="flex flex-col gap-4">
                {/* TÍTULO */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300">
                    Título de la tarea
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Compras casa, Arreglar el jardín, Pagar cuenta de luz"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                {/* PRIORIDAD */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-neutral-300">
                    Prioridad de la tarea
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'normal', label: '🟢 Normal', style: 'border-emerald-600 bg-emerald-950/20 text-white' },
                      { id: 'media', label: '🟡 Media', style: 'border-amber-600 bg-amber-950/20 text-white' },
                      { id: 'alta', label: '🔴 Urgente', style: 'border-red-600 bg-red-950/30 text-white shadow-sm ring-1 ring-red-600/40' },
                    ].map((p) => {
                      const isSelected = priority === p.id
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPriority(p.id as TodoPriority)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center border ${
                            isSelected
                              ? p.style
                              : 'bg-[#131313] border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* DETALLE OPCIONAL */}
                <div className="flex flex-col gap-1.5 p-3 bg-[#131313] border border-neutral-800/80 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">≡</span>
                      <label className="text-[11px] font-bold text-neutral-300">
                        Detalle de la tarea (opcional)
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHasDetails(!hasDetails)}
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                        hasDetails
                          ? 'bg-[#F76911]/20 text-[#F76911] border border-[#F76911]/40'
                          : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/40'
                      }`}
                    >
                      {hasDetails ? '✓ Detalle activado' : '+ Activar detalle'}
                    </button>
                  </div>

                  {hasDetails && (
                    <textarea
                      rows={2}
                      placeholder="Escribe notas o enlaces web (https://...)..."
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className="w-full bg-[#181818] border border-neutral-700/60 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#F76911] mt-1 resize-y"
                    />
                  )}
                </div>

                {/* ENLACE WEB DIRECTO (LINK) */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
                    <span>🔗</span>
                    <span>Enlace o URL relacionado (opcional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/portal-de-pago"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F76911]"
                  />
                </div>

                {/* CATEGORÍA */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1">
                      <span>🏷️</span>
                      <span>Categoría</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('categories')}
                      className="text-[10px] text-[#F76911] hover:underline font-bold cursor-pointer"
                    >
                      + Crear / Gestionar categorías
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#131313] border border-neutral-800 rounded-2xl max-h-32 overflow-y-auto scrollbar-none">
                    {categories.map((cat) => {
                      const isSelected = (category || 'Sin categoría').toLowerCase() === cat.name.toLowerCase()
                      const col = cat.color || '#737373'
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.name)}
                          style={
                            isSelected
                              ? { backgroundColor: col, borderColor: col, color: '#ffffff' }
                              : undefined
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'shadow-md scale-[1.02]'
                              : 'bg-neutral-800/50 text-neutral-300 hover:text-white border border-neutral-700/40'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: isSelected ? '#ffffff' : col }}
                          />
                          <span>{cat.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* SUBTAREAS CHECKLIST */}
                <div className="flex flex-col gap-2 p-3.5 bg-[#131313] border border-neutral-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📋</span>
                      <label className="text-[11px] font-bold text-neutral-300">
                        Subtareas (Lista de comprobación)
                      </label>
                      <span className="text-[10px] text-neutral-500 font-medium">
                        ({subtasksDraft.length})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={addSubtaskDraft}
                      className="px-2.5 py-1 rounded-xl bg-[#F76911]/20 hover:bg-[#F76911]/30 border border-[#F76911]/40 text-[#F76911] text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1"
                    >
                      <span>+</span>
                      <span>Añadir subtarea</span>
                    </button>
                  </div>

                  {subtasksDraft.length === 0 ? (
                    <p className="text-xs text-neutral-500 m-0 py-2 text-center">
                      Esta tarea no tiene subtareas. Pulsa &quot;+ Añadir subtarea&quot; para desglosarla.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5 pt-1">
                      {subtasksDraft.map((st, idx) => (
                        <div
                          key={st.id}
                          className="p-3 bg-[#181818] border border-neutral-700/60 rounded-xl flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-neutral-500 shrink-0 flex items-center justify-center text-[10px] text-neutral-500">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              placeholder="Ej. Comprar refrigerador..."
                              value={st.title}
                              onChange={(e) => updateSubtaskField(st.id, 'title', e.target.value)}
                              className="flex-1 bg-[#121212] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#F76911]"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title="Activar detalle de la subtarea"
                                onClick={() =>
                                  updateSubtaskField(st.id, 'showDetails', !st.showDetails)
                                }
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  st.showDetails
                                    ? 'bg-[#F76911] text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                ≡ Detalle
                              </button>
                              <button
                                type="button"
                                title="Activar recordatorio de la subtarea"
                                onClick={() =>
                                  updateSubtaskField(st.id, 'showReminder', !st.showReminder)
                                }
                                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  st.showReminder
                                    ? 'bg-[#F76911] text-white'
                                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                                }`}
                              >
                                ⏰
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSubtaskDraft(st.id)}
                                className="w-7 h-7 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 flex items-center justify-center font-bold text-xs cursor-pointer"
                                title="Eliminar subtarea"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {st.showDetails && (
                            <div className="flex flex-col gap-1 pl-6">
                              <label className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                                <span>≡</span>
                                <span>Detalles o enlaces de esta subtarea:</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Notas o especificaciones específicas..."
                                value={st.details}
                                onChange={(e) => updateSubtaskField(st.id, 'details', e.target.value)}
                                className="w-full bg-[#121212] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#F76911]"
                              />
                            </div>
                          )}

                          {st.showReminder && (
                            <div className="flex flex-col gap-1 pl-6">
                              <label className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                                <span>⏰</span>
                                <span>Recordatorio de esta subtarea:</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={st.due_date}
                                  onChange={(e) => updateSubtaskField(st.id, 'due_date', e.target.value)}
                                  className="w-full bg-[#121212] border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-[#F76911] scheme-dark"
                                />
                                {st.due_date && (
                                  <button
                                    type="button"
                                    onClick={() => updateSubtaskField(st.id, 'due_date', '')}
                                    className="text-[10px] text-[#F76911] font-bold hover:underline shrink-0"
                                  >
                                    Quitar
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ASIGNACIÓN DE INTEGRANTES */}
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
                    </div>
                  </div>

                  <div className="p-3 bg-[#131313] border border-neutral-800 rounded-2xl flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={clearSelectedMembers}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          selectedMembers.length === 0
                            ? 'bg-[#F76911] text-white shadow-md'
                            : 'bg-neutral-800/60 text-neutral-400 hover:text-white border border-neutral-700/50'
                        }`}
                      >
                        <span>🏠</span>
                        <span>Toda la familia</span>
                      </button>

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
                                : 'bg-neutral-800/60 text-neutral-300 hover:text-white border border-neutral-700/50'
                            }`}
                          >
                            <span>{isSelected ? '✓' : '👤'}</span>
                            <span>{name}</span>
                          </button>
                        )
                      })}
                    </div>
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

                {/* RECURRENCIA */}
                {isRecurring && (
                  <div className="flex flex-col gap-2.5 p-3.5 bg-[#141d17] border border-emerald-900/60 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-300">
                        ¿Cada cuántos días se repite?
                      </label>
                      <span className="text-xs font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                        {formatRecurrenceShort(recurrenceDays)}
                      </span>
                    </div>

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
                  </div>
                )}

                {/* RECORDATORIO & ALERTA PUSH */}
                <div className="flex flex-col gap-1 p-3 bg-[#131313] border border-neutral-800/90 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                      <span>⏰</span>
                      <span>Recordatorio / Fecha y hora límite</span>
                    </label>
                    {dueDateTime && (
                      <button
                        type="button"
                        onClick={() => setDueDateTime('')}
                        className="text-[10px] text-[#F76911] font-bold hover:underline cursor-pointer"
                      >
                        Quitar recordatorio
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={dueDateTime}
                    onChange={(e) => setDueDateTime(e.target.value)}
                    className="w-full bg-[#181818] border border-neutral-700/80 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#F76911] cursor-pointer scheme-dark"
                  />
                  <p className="text-[10px] text-neutral-500 m-0">
                    🔔 Recibirás una notificación push a esta fecha y hora si tienes las notificaciones activadas.
                  </p>
                  {dueDateTime && isTaskOverdue(dueDateTime) && (
                    <p className="text-[11px] text-red-400 font-bold m-0 flex items-center gap-1.5 mt-0.5">
                      <span>⚠️</span>
                      <span>Esta fecha y hora ya pasaron (Tarea vencida).</span>
                    </p>
                  )}
                </div>

                {/* BOTONES GUARDAR / ELIMINAR */}
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
            )}

            {/* TAB 2: PESTAÑA PARA GESTIONAR CATEGORÍAS */}
            {activeTab === 'categories' && (
              <div className="flex flex-col gap-4">
                <form
                  onSubmit={handleCreateCategory}
                  className="p-4 bg-[#131313] border border-neutral-800 rounded-2xl flex flex-col gap-3"
                >
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider m-0">
                    Crear nueva categoría
                  </h3>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-neutral-400">
                      Nombre de la categoría
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Trámites, Mascotas, Jardín..."
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full bg-[#181818] border border-neutral-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F76911]"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-neutral-400">
                      Color identificador
                    </label>
                    <div className="flex items-center gap-2">
                      {CATEGORY_COLORS.map((col) => (
                        <button
                          key={col.hex}
                          type="button"
                          onClick={() => setNewCatColor(col.hex)}
                          style={{ backgroundColor: col.hex }}
                          className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                            newCatColor === col.hex
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={col.name}
                        >
                          {newCatColor === col.hex && <span className="text-white text-xs">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingCategory || !newCatName.trim()}
                    style={orangeGradient}
                    className="w-full py-2.5 rounded-xl text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-50 mt-1"
                  >
                    {savingCategory ? 'Guardando...' : '+ Crear categoría'}
                  </button>
                </form>

                <div className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-neutral-400 px-1 m-0">
                    Categorías disponibles ({categories.length})
                  </h3>

                  {categories.length === 1 && (
                    <p className="text-xs text-neutral-500 m-0 py-2 text-center bg-[#131313] p-3 rounded-xl border border-neutral-800">
                      Aún no has creado categorías personalizadas. Escribe un nombre arriba y pulsa &quot;+ Crear categoría&quot;.
                    </p>
                  )}

                  <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
                    {categories.map((cat) => {
                      const isDefault = cat.id === 'default-sin-categoria' || cat.name.toLowerCase() === 'sin categoría'
                      const count = todos.filter((t) => {
                        if (isDefault) {
                          return !t.category || t.category.toLowerCase() === 'sin categoría'
                        }
                        return t.category?.toLowerCase() === cat.name.toLowerCase()
                      }).length

                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#131313] border border-neutral-800/80"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0"
                              style={{ backgroundColor: cat.color || '#737373' }}
                            />
                            <span className="text-xs font-bold text-white">{cat.name}</span>
                            {isDefault ? (
                              <span className="text-[10px] text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md font-semibold">
                                Predeterminada
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500 font-medium">
                                ({count} {count === 1 ? 'tarea' : 'tareas'})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCategory(cat.name)
                                setActiveTab('task')
                              }}
                              className="px-2 py-1 rounded-lg bg-neutral-800 text-[10px] font-bold text-neutral-300 hover:text-white cursor-pointer"
                            >
                              Usar en tarea
                            </button>
                            {!isDefault && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                className="w-6 h-6 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 flex items-center justify-center font-bold text-xs cursor-pointer"
                                title="Eliminar categoría"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('task')}
                  className="w-full py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  ← Volver al formulario de la tarea
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { createClient } from '@/lib/supabase/client'
import { offlineDB } from './db'
import type {
  SyncEntity,
  SyncQueueItem,
  LocalMedicine,
  LocalSchoolTask,
  LocalExam,
  LocalShoppingItem,
  LocalTodo,
} from './types'

// Mapeo entre entidades Dexie y tablas en Supabase
const ENTITY_TABLE_MAP: Record<SyncEntity, string> = {
  medicines: 'medications',
  school_tasks: 'school_homework',
  exams: 'school_tests',
  shopping_lists: 'shopping_items',
  todos: 'todos',
}

type SyncListener = (status: {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: Date | null
}) => void

class SyncManager {
  private isSyncing = false
  private lastSyncTime: Date | null = null
  private listeners: Set<SyncListener> = new Set()
  private initialized = false

  constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  /**
   * Inicializa listeners de conectividad y mensajes del Service Worker
   */
  public init() {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    // Listener para reconexión de red
    window.addEventListener('online', () => {
      console.log('[SyncManager] Conexión recuperada. Procesando cola...')
      this.notify()
      this.processSyncQueue()
    })

    window.addEventListener('offline', () => {
      console.log('[SyncManager] Dispositivo sin conexión. Modo Offline activado.')
      this.notify()
    })

    // Listener de mensajes desde el Service Worker (ej. Background Sync)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
          console.log('[SyncManager] Mensaje de Background Sync recibido.')
          this.processSyncQueue()
        }
      })
    }

    // Si ya estamos online al iniciar, procesar si hay pendientes
    if (navigator.onLine) {
      setTimeout(() => this.processSyncQueue(), 2000)
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener)
    listener({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
    })
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.listeners.forEach((l) =>
      l({
        isOnline,
        isSyncing: this.isSyncing,
        lastSyncTime: this.lastSyncTime,
      })
    )
  }

  /**
   * Solicita al Service Worker registrar un Background Sync si está disponible
   */
  public requestBackgroundSync() {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'SyncManager' in window
    ) {
      navigator.serviceWorker.ready
        .then((reg: any) => reg.sync?.register('casa-sync-queue'))
        .catch(() => {})
    }
  }

  /**
   * Procesa la cola de sincronización transaccional (sync_queue) hacia Supabase
   */
  public async processSyncQueue(): Promise<{ processed: number; errors: number }> {
    if (this.isSyncing) return { processed: 0, errors: 0 }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { processed: 0, errors: 0 }
    }

    this.isSyncing = true
    this.notify()

    let processedCount = 0
    let errorCount = 0

    try {
      // Obtener items pendientes ordenados por timestamp
      const pendingItems = await offlineDB.sync_queue
        .where('status')
        .equals('pending')
        .sortBy('timestamp')

      if (pendingItems.length === 0) {
        this.isSyncing = false
        this.notify()
        return { processed: 0, errors: 0 }
      }

      const supabase = createClient()

      for (const item of pendingItems) {
        // Verificar si seguimos online
        if (!navigator.onLine) {
          console.warn('[SyncManager] Se perdió la conexión durante la sincronización.')
          break
        }

        const tableName = ENTITY_TABLE_MAP[item.entity]
        if (!tableName) {
          console.error(`[SyncManager] Entidad desconocida: ${item.entity}`)
          await offlineDB.sync_queue.delete(item.id!)
          continue
        }

        // Marcar como en proceso
        await offlineDB.sync_queue.update(item.id!, { status: 'syncing' })

        try {
          let error: any = null

          // Limpiar metadatos locales antes de enviar a Supabase
          const cleanPayload = { ...item.payload }
          delete cleanPayload._synced
          delete cleanPayload._updated_at

          if (item.action === 'INSERT' || item.action === 'UPDATE') {
            const { error: upsertErr } = await supabase
              .from(tableName)
              .upsert(cleanPayload, { onConflict: 'id' })
            error = upsertErr
          } else if (item.action === 'DELETE') {
            const { error: deleteErr } = await supabase
              .from(tableName)
              .delete()
              .eq('id', item.entityId)
            error = deleteErr
          }

          if (error) {
            throw error
          }

          // Mutación exitosa: eliminar de la cola y marcar la entidad local como sincronizada
          await offlineDB.sync_queue.delete(item.id!)

          if (item.action !== 'DELETE') {
            const table = offlineDB[item.entity] as any
            if (table) {
              await table.update(item.entityId, { _synced: true }).catch(() => {})
            }
          }

          processedCount++
        } catch (err: any) {
          console.error(`[SyncManager] Error sincronizando ${item.entity} (${item.action}):`, err)
          errorCount++
          const retries = (item.retries || 0) + 1
          await offlineDB.sync_queue.update(item.id!, {
            status: retries >= 5 ? 'failed' : 'pending',
            retries,
            lastError: err?.message || String(err),
          })

          // Si es un error de autenticación o RLS grave, pausar reintentos continuos
          if (err?.code === 'PGRST301' || err?.message?.includes('JWT')) {
            break
          }
        }
      }

      this.lastSyncTime = new Date()
      if (typeof window !== 'undefined' && processedCount > 0) {
        window.dispatchEvent(new CustomEvent('casa-sync-complete', { detail: { processed: processedCount } }))
      }
    } catch (globalErr) {
      console.error('[SyncManager] Error general en processSyncQueue:', globalErr)
    } finally {
      this.isSyncing = false
      this.notify()
    }

    return { processed: processedCount, errors: errorCount }
  }

  /**
   * Hidrata los datos desde Supabase hacia Dexie para disponibilidad offline
   */
  public async pullRemoteData(familyId: string) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!familyId) return

    try {
      const supabase = createClient()

      // Descargar datos en paralelo desde Supabase
      const [medsRes, tasksRes, examsRes, shoppingRes, todosRes, membersRes] = await Promise.all([
        supabase.from('medications').select('*').eq('family_id', familyId),
        supabase.from('school_homework').select('*').eq('family_id', familyId),
        supabase.from('school_tests').select('*').eq('family_id', familyId),
        supabase.from('shopping_items').select('*').eq('family_id', familyId),
        supabase.from('todos').select('*').eq('family_id', familyId),
        supabase.from('family_members').select('id, name, user_id').eq('family_id', familyId),
      ])

      // Guardar lista de integrantes en cache local
      if (membersRes.data && typeof window !== 'undefined') {
        try {
          localStorage.setItem('casa_family_members', JSON.stringify(membersRes.data))
        } catch {}
      }

      // 1. Guardar Medicamentos en Dexie (preservando los pendientes offline)
      if (medsRes.data) {
        const currentMeds = await offlineDB.medicines.where('family_id').equals(familyId).toArray()
        const unsyncedIds = new Set(currentMeds.filter((m) => !m._synced).map((m) => m.id))
        const remoteIds = new Set(medsRes.data.map((m: any) => m.id))

        // Eliminar en Dexie los sincronizados que ya no están en Supabase para esta familia
        const toDelete = currentMeds
          .filter((m) => m._synced && !remoteIds.has(m.id))
          .map((m) => m.id)
        if (toDelete.length > 0) {
          await offlineDB.medicines.bulkDelete(toDelete)
        }

        const localMeds: LocalMedicine[] = medsRes.data
          .filter((m: any) => !unsyncedIds.has(m.id))
          .map((m: any) => ({
            id: m.id,
            family_id: m.family_id,
            name: m.name,
            person: m.person,
            dose: m.dose,
            times: m.times || [],
            frequency: m.frequency,
            end_date: m.end_date,
            created_at: m.created_at,
            _synced: true,
          }))
        if (localMeds.length > 0) {
          await offlineDB.medicines.bulkPut(localMeds)
        }
      }

      // 2. Guardar Tareas Escolares en Dexie
      if (tasksRes.data) {
        const currentTasks = await offlineDB.school_tasks.where('family_id').equals(familyId).toArray()
        const unsyncedIds = new Set(currentTasks.filter((t) => !t._synced).map((t) => t.id))
        const remoteIds = new Set(tasksRes.data.map((t: any) => t.id))

        const toDelete = currentTasks
          .filter((t) => t._synced && !remoteIds.has(t.id))
          .map((t) => t.id)
        if (toDelete.length > 0) {
          await offlineDB.school_tasks.bulkDelete(toDelete)
        }

        const localTasks: LocalSchoolTask[] = tasksRes.data
          .filter((t: any) => !unsyncedIds.has(t.id))
          .map((t: any) => ({
            id: t.id,
            family_id: t.family_id,
            subject: t.subject,
            task: t.task,
            due: t.due || t.due_date || '',
            due_date: t.due_date || t.due,
            done: t.done || false,
            done_at: t.done_at,
            created_at: t.created_at,
            _synced: true,
          }))
        if (localTasks.length > 0) {
          await offlineDB.school_tasks.bulkPut(localTasks)
        }
      }

      // 3. Guardar Exámenes/Pruebas en Dexie
      if (examsRes.data) {
        const currentExams = await offlineDB.exams.where('family_id').equals(familyId).toArray()
        const unsyncedIds = new Set(currentExams.filter((e) => !e._synced).map((e) => e.id))
        const remoteIds = new Set(examsRes.data.map((e: any) => e.id))

        const toDelete = currentExams
          .filter((e) => e._synced && !remoteIds.has(e.id))
          .map((e) => e.id)
        if (toDelete.length > 0) {
          await offlineDB.exams.bulkDelete(toDelete)
        }

        const localExams: LocalExam[] = examsRes.data
          .filter((e: any) => !unsyncedIds.has(e.id))
          .map((e: any) => ({
            id: e.id,
            family_id: e.family_id,
            subject: e.subject,
            topic: e.topic,
            test_date: e.test_date,
            created_at: e.created_at,
            _synced: true,
          }))
        if (localExams.length > 0) {
          await offlineDB.exams.bulkPut(localExams)
        }
      }

      // 4. Guardar Lista de Compras en Dexie
      if (shoppingRes.data) {
        const currentShop = await offlineDB.shopping_lists.where('family_id').equals(familyId).toArray()
        const unsyncedIds = new Set(currentShop.filter((s) => !s._synced).map((s) => s.id))
        const remoteIds = new Set(shoppingRes.data.map((s: any) => s.id))

        const toDelete = currentShop
          .filter((s) => s._synced && !remoteIds.has(s.id))
          .map((s) => s.id)
        if (toDelete.length > 0) {
          await offlineDB.shopping_lists.bulkDelete(toDelete)
        }

        const localShopping: LocalShoppingItem[] = shoppingRes.data
          .filter((s: any) => !unsyncedIds.has(s.id))
          .map((s: any) => ({
            id: s.id,
            family_id: s.family_id,
            list: s.list as 'super' | 'feria',
            name: s.name,
            category: s.category || undefined,
            quantity: s.quantity || undefined,
            done: s.done || false,
            done_at: s.done_at,
            created_at: s.created_at,
            _synced: true,
          }))
        if (localShopping.length > 0) {
          await offlineDB.shopping_lists.bulkPut(localShopping)
        }
      }

      // 5. Guardar Tareas del Hogar (todos) en Dexie
      if (todosRes.data) {
        const currentTodos = await offlineDB.todos.where('family_id').equals(familyId).toArray()
        const unsyncedIds = new Set(currentTodos.filter((t) => !t._synced).map((t) => t.id))
        const remoteIds = new Set(todosRes.data.map((t: any) => t.id))

        const toDelete = currentTodos
          .filter((t) => t._synced && !remoteIds.has(t.id))
          .map((t) => t.id)
        if (toDelete.length > 0) {
          await offlineDB.todos.bulkDelete(toDelete)
        }

        const localTodos: LocalTodo[] = todosRes.data
          .filter((t: any) => !unsyncedIds.has(t.id))
          .map((t: any) => ({
            id: t.id,
            family_id: t.family_id,
            title: t.title,
            assigned_to: t.assigned_to,
            due_date: t.due_date,
            done: t.done || false,
            done_at: t.done_at,
            created_at: t.created_at,
            _synced: true,
          }))
        if (localTodos.length > 0) {
          await offlineDB.todos.bulkPut(localTodos)
        }
      }

      this.lastSyncTime = new Date()
      this.notify()
      console.log('[SyncManager] Datos locales hidratados exitosamente desde Supabase.')
    } catch (err) {
      console.error('[SyncManager] Error al descargar datos remotos:', err)
    }
  }
}

export const syncManager = new SyncManager()

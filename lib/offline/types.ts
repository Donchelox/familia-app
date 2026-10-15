/**
 * Tipos de datos para el ecosistema Offline-First de Casa
 * Compatible con Dexie.js e IndexedDB
 */

export type SyncEntity = 'medicines' | 'school_tasks' | 'exams' | 'shopping_lists' | 'todos'
export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type SyncStatus = 'pending' | 'syncing' | 'failed'

/**
 * Registro de mutación en la cola de sincronización transaccional
 */
export interface SyncQueueItem {
  id?: number
  mutationId: string
  familyId: string
  entity: SyncEntity
  action: SyncAction
  entityId: string
  payload: Record<string, any>
  timestamp: number
  status: SyncStatus
  retries: number
  lastError?: string
}

/**
 * Entidad local: Medicamento
 */
export interface LocalMedicine {
  id: string
  family_id: string
  name: string
  person: string
  dose: string
  times: string[]
  frequency?: string
  end_date?: string
  created_at?: string
  _synced?: boolean
  _updated_at?: number
}

/**
 * Entidad local: Tarea Escolar
 */
export interface LocalSchoolTask {
  id: string
  family_id: string
  subject: string
  task: string
  due: string
  due_date?: string | null
  done: boolean
  done_at?: string | null
  created_at?: string
  _synced?: boolean
  _updated_at?: number
}

/**
 * Entidad local: Examen o Prueba escolar
 */
export interface LocalExam {
  id: string
  family_id: string
  subject: string
  topic?: string
  test_date: string
  created_at?: string
  _synced?: boolean
  _updated_at?: number
}

/**
 * Entidad local: Ítem de compra (Supermercado o Feria)
 */
export interface LocalShoppingItem {
  id: string
  family_id: string
  list: 'super' | 'feria'
  name: string
  done: boolean
  done_at?: string | null
  created_at?: string
  _synced?: boolean
  _updated_at?: number
}

/**
 * Entidad local: Tarea del hogar / Quehacer
 */
export interface LocalTodo {
  id: string
  family_id: string
  title: string
  assigned_to?: string | null
  due_date?: string | null
  done: boolean
  done_at?: string | null
  created_at?: string
  _synced?: boolean
  _updated_at?: number
}

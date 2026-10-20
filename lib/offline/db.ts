import Dexie, { type Table } from 'dexie'
import type {
  LocalMedicine,
  LocalSchoolTask,
  LocalExam,
  LocalShoppingItem,
  LocalTodo,
  LocalTodoCategory,
  SyncQueueItem,
} from './types'

/**
 * Base de datos local IndexedDB para Casa App utilizando Dexie.js
 * Capa de persistencia Offline-First para medicamentos, tareas escolares,
 * exámenes, listas de compras, quehaceres del hogar, categorías y la cola transaccional de sincronización.
 */
export class CasaOfflineDatabase extends Dexie {
  medicines!: Table<LocalMedicine, string>
  school_tasks!: Table<LocalSchoolTask, string>
  exams!: Table<LocalExam, string>
  shopping_lists!: Table<LocalShoppingItem, string>
  todos!: Table<LocalTodo, string>
  todo_categories!: Table<LocalTodoCategory, string>
  sync_queue!: Table<SyncQueueItem, number>

  constructor() {
    super('CasaOfflineDB')

    // Esquemas de versiones
    // Sintaxis de Dexie: 'primaryKey, index1, index2, ...'
    // '++id' es auto-incremental numérico
    this.version(1).stores({
      medicines: 'id, family_id, person, name, created_at, _synced',
      school_tasks: 'id, family_id, subject, due, done, created_at, _synced',
      exams: 'id, family_id, subject, test_date, created_at, _synced',
      shopping_lists: 'id, family_id, list, name, done, created_at, _synced',
      sync_queue: '++id, mutationId, familyId, entity, action, status, timestamp',
    })

    this.version(2).stores({
      medicines: 'id, family_id, person, name, created_at, _synced',
      school_tasks: 'id, family_id, subject, due, due_date, done, created_at, _synced',
      exams: 'id, family_id, subject, test_date, created_at, _synced',
      shopping_lists: 'id, family_id, list, name, done, created_at, _synced',
      todos: 'id, family_id, title, assigned_to, due_date, done, created_at, _synced',
      sync_queue: '++id, mutationId, familyId, entity, action, status, timestamp',
    })

    this.version(3).stores({
      medicines: 'id, family_id, person, name, created_at, _synced',
      school_tasks: 'id, family_id, subject, due, due_date, done, created_at, _synced',
      exams: 'id, family_id, subject, test_date, created_at, _synced',
      shopping_lists: 'id, family_id, list, name, done, created_at, _synced',
      todos: 'id, family_id, title, category, assigned_to, due_date, done, created_at, _synced',
      todo_categories: 'id, family_id, name, created_at, _synced',
      sync_queue: '++id, mutationId, familyId, entity, action, status, timestamp',
    })
  }

  /**
   * Helper transaccional para limpiar o resetear datos locales
   */
  async clearAllTables() {
    await this.transaction('rw', [
      this.medicines,
      this.school_tasks,
      this.exams,
      this.shopping_lists,
      this.todos,
      this.todo_categories,
      this.sync_queue,
    ], async () => {
      await this.medicines.clear()
      await this.school_tasks.clear()
      await this.exams.clear()
      await this.shopping_lists.clear()
      await this.todos.clear()
      await this.todo_categories.clear()
      await this.sync_queue.clear()
    })
  }
}

// Singleton de base de datos para el cliente del navegador
export const offlineDB = new CasaOfflineDatabase()

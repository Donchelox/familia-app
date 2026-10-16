'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB } from './db'
import type {
  LocalMedicine,
  LocalSchoolTask,
  LocalExam,
  LocalShoppingItem,
} from './types'

/**
 * Hook para consultar medicamentos locales reactivamente
 */
export function useLocalMedicines(familyId?: string) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return await offlineDB.medicines.where('family_id').equals(familyId).toArray()
    },
    [familyId],
    [] as LocalMedicine[]
  )
}

/**
 * Hook para consultar tareas escolares locales reactivamente
 */
export function useLocalSchoolTasks(familyId?: string) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return await offlineDB.school_tasks.where('family_id').equals(familyId).toArray()
    },
    [familyId],
    [] as LocalSchoolTask[]
  )
}

/**
 * Hook para consultar exámenes/pruebas locales reactivamente
 */
export function useLocalExams(familyId?: string) {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      return await offlineDB.exams.where('family_id').equals(familyId).toArray()
    },
    [familyId],
    [] as LocalExam[]
  )
}

/**
 * Hook para consultar listas de compras locales reactivamente
 */
export function useLocalShopping(familyId?: string, listType?: 'super' | 'feria') {
  return useLiveQuery(
    async () => {
      if (!familyId) return []
      const all = await offlineDB.shopping_lists.where('family_id').equals(familyId).toArray()
      if (listType) {
        return all.filter((item) => item.list === listType)
      }
      return all
    },
    [familyId, listType],
    [] as LocalShoppingItem[]
  )
}

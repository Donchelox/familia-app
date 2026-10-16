'use client'

import { offlineDB } from './db'


/**
 * Guarda el familyId activo en localStorage para uso inmediato offline
 */
export function saveOfflineFamilyId(familyId: string) {
  if (typeof window !== 'undefined' && familyId && familyId.trim()) {
    try {
      localStorage.setItem('casa_family_id', familyId.trim())
    } catch {}
  }
}

/**
 * Obtiene el familyId de forma resiliente, buscando en localStorage,
 * en cualquiera de las tablas de Dexie, o devolviendo un ID seguro.
 */
export async function getOfflineFamilyId(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const fromStorage = localStorage.getItem('casa_family_id')
      if (fromStorage && fromStorage.trim()) {
        return fromStorage.trim()
      }
    } catch {}
  }

  // Buscar en las tablas locales de Dexie si hay algún registro existente con family_id
  try {
    const [shop, todo, med, exam, task] = await Promise.all([
      offlineDB.shopping_lists.toCollection().first(),
      offlineDB.todos.toCollection().first(),
      offlineDB.medicines.toCollection().first(),
      offlineDB.exams.toCollection().first(),
      offlineDB.school_tasks.toCollection().first(),
    ])

    const found =
      shop?.family_id ||
      todo?.family_id ||
      med?.family_id ||
      exam?.family_id ||
      task?.family_id

    if (found && found.trim()) {
      saveOfflineFamilyId(found.trim())
      return found.trim()
    }
  } catch (err) {
    console.debug('[OfflineContext] Error leyendo family_id de Dexie:', err)
  }

  return ''
}

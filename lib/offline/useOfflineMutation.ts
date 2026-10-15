'use client'

import { useState, useCallback } from 'react'
import { offlineDB } from './db'
import { syncManager } from './syncManager'
import type { SyncEntity, SyncAction } from './types'

interface MutationOptions {
  familyId: string
  entity: SyncEntity
  action: SyncAction
  entityId?: string
  payload?: Record<string, any>
}

export function useOfflineMutation() {
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async ({
      familyId,
      entity,
      action,
      entityId,
      payload = {},
    }: MutationOptions) => {
      setIsMutating(true)
      setError(null)

      try {
        // Generar UUID consistente si no se proporcionó
        const finalId =
          entityId ||
          payload.id ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `loc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)

        const table = offlineDB[entity] as any
        const now = Date.now()

        // 1. ESCRITURA OPTIMISTA INMEDIATA EN DEXIE.JS
        if (action === 'INSERT' || action === 'UPDATE') {
          const localRecord = {
            ...payload,
            id: finalId,
            family_id: familyId,
            _synced: false,
            _updated_at: now,
          }
          await table.put(localRecord)
        } else if (action === 'DELETE') {
          await table.delete(finalId)
        }

        // 2. ENCOLAR EN LA COLA TRANSACCIONAL (sync_queue)
        const mutationId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `mut_${now}_${Math.random().toString(36).slice(2, 7)}`

        await offlineDB.sync_queue.add({
          mutationId,
          familyId,
          entity,
          action,
          entityId: finalId,
          payload: { ...payload, id: finalId, family_id: familyId },
          timestamp: now,
          status: 'pending',
          retries: 0,
        })

        // 3. REGISTRAR BACKGROUND SYNC Y PROCESAR SI ESTAMOS ONLINE
        syncManager.requestBackgroundSync()

        if (typeof navigator !== 'undefined' && navigator.onLine) {
          // Ejecutar en segundo plano de manera no bloqueante
          syncManager.processSyncQueue().catch((syncErr) => {
            console.warn('[useOfflineMutation] Fallo en intento inmediato de sincronización:', syncErr)
          })
        }

        setIsMutating(false)
        return { success: true, id: finalId }
      } catch (err: any) {
        console.error('[useOfflineMutation] Error ejecutando mutación local:', err)
        setError(err?.message || 'Error al guardar localmente')
        setIsMutating(false)
        throw err
      }
    },
    []
  )

  return {
    mutate,
    isMutating,
    error,
  }
}

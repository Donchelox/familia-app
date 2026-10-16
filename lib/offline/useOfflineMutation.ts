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

function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
        // Generar UUID v4 válido y consistente para PostgreSQL
        const finalId = entityId || payload.id || safeUUID()

        const table = offlineDB[entity] as any
        const now = Date.now()

        // 1. ESCRITURA OPTIMISTA INMEDIATA EN DEXIE.JS
        let baseUpdatedAt: string | undefined = undefined
        if (action === 'INSERT' || action === 'UPDATE') {
          if (action === 'UPDATE') {
            const currentRecord = await table.get(finalId)
            baseUpdatedAt = currentRecord?.updated_at || currentRecord?._base_updated_at
          }
          const localRecord = {
            ...payload,
            id: finalId,
            family_id: familyId,
            _synced: false,
            _updated_at: now,
            _base_updated_at: baseUpdatedAt,
          }
          await table.put(localRecord)
        } else if (action === 'DELETE') {
          await table.delete(finalId)
        }

        // 2. ENCOLAR EN LA COLA TRANSACCIONAL (sync_queue)
        const mutationId = safeUUID()

        await offlineDB.sync_queue.add({
          mutationId,
          familyId,
          entity,
          action,
          entityId: finalId,
          payload: { ...payload, id: finalId, family_id: familyId },
          baseUpdatedAt,
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

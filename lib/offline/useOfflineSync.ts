'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB } from './db'
import { syncManager } from './syncManager'

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Cantidad de mutaciones pendientes en la cola transaccional (reactivo en tiempo real vía Dexie)
  const pendingCount = useLiveQuery(
    () => offlineDB.sync_queue.where('status').equals('pending').count(),
    [],
    0
  )

  useEffect(() => {
    // Sincronizar inmediatamente con navigator.onLine al montar en el cliente
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    // Suscribirse al estado del SyncManager
    const unsubscribe = syncManager.subscribe((status) => {
      setIsOnline(status.isOnline)
      setIsSyncing(status.isSyncing)
      if (status.lastSyncTime) {
        setLastSyncTime(status.lastSyncTime)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return
    await syncManager.processSyncQueue()
  }, [])

  const pullRemote = useCallback(async (familyId: string) => {
    if (!navigator.onLine || !familyId) return
    await syncManager.pullRemoteData(familyId)
  }, [])

  return {
    isOnline,
    isSyncing,
    pendingCount: pendingCount ?? 0,
    lastSyncTime,
    syncNow,
    pullRemote,
  }
}

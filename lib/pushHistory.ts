// Historial de notificaciones push recibidas en ESTE dispositivo.
// Lo escribe el service worker (public/sw.js) en IndexedDB y lo leen la campana y /notificaciones.
// Si cambias DB_NAME / STORE / esquema, cámbialo también en public/sw.js.

export interface PushNotificationItem {
  id: string
  title: string
  body?: string
  url?: string | null
  received_at?: string
  read?: boolean
  tag?: string
}

const DB_NAME = 'casa-push'
const STORE = 'notifications'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('received_at', 'received_at')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const hasIdb = () => typeof indexedDB !== 'undefined'

/** Más recientes primero. */
export async function getHistory(): Promise<PushNotificationItem[]> {
  if (!hasIdb()) return []
  const db = await openDb()
  try {
    return await new Promise<PushNotificationItem[]>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () =>
        resolve(
          (req.result as PushNotificationItem[]).sort((a, b) =>
            (b.received_at ?? '').localeCompare(a.received_at ?? '')
          )
        )
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function countUnread(): Promise<number> {
  return (await getHistory()).filter((i) => !i.read).length
}

export async function markAllRead(): Promise<void> {
  if (!hasIdb()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const cur = tx.objectStore(STORE).openCursor()
      cur.onsuccess = () => {
        const c = cur.result
        if (!c) return
        if (!c.value.read) c.update({ ...c.value, read: true })
        c.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function deleteOne(id: string): Promise<void> {
  if (!hasIdb()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function clearAll(): Promise<void> {
  if (!hasIdb()) return
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

/** Ejecuta cb cuando llega un push nuevo, al volver a la app o al cambiar el historial. Devuelve la función de limpieza. */
export function onHistoryChange(cb: () => void): () => void {
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'push-history-updated') cb()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') cb()
  }
  navigator.serviceWorker?.addEventListener('message', onMessage)
  window.addEventListener('focus', cb)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    navigator.serviceWorker?.removeEventListener('message', onMessage)
    window.removeEventListener('focus', cb)
    document.removeEventListener('visibilitychange', onVisible)
  }
}

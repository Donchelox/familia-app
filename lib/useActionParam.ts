import { useEffect } from 'react'

/**
 * Lee ?action=<nombre> al montar la página, ejecuta el handler correspondiente
 * (p. ej. abrir el bottom sheet de "nuevo") y limpia el parámetro de la URL.
 * Usa window.location en vez de useSearchParams para no exigir <Suspense> en el build.
 */
export function useActionParam(handlers: Record<string, () => void>) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const action = params.get('action')
    if (!action) return
    handlers[action]?.()
    params.delete('action')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

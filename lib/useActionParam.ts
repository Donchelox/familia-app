'use client'

import { useEffect, useRef } from 'react'

/**
 * Lee ?action=<nombre> al montar la página o recibir una navegación cliente,
 * ejecuta el handler correspondiente (ej. abrir el bottom sheet de "nuevo")
 * y limpia el parámetro de la URL de forma segura.
 */
export function useActionParam(handlers: Record<string, () => void>) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function checkAction() {
      if (typeof window === 'undefined') return
      try {
        const search = window.location.search || (window.location.href.includes('?') ? '?' + window.location.href.split('?')[1] : '')
        if (!search) return

        const params = new URLSearchParams(search)
        const action = params.get('action')
        if (!action) return

        const handler = handlersRef.current[action]
        if (typeof handler === 'function') {
          handler()
          params.delete('action')
          const qs = params.toString()
          const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '')
          window.history.replaceState(null, '', cleanUrl)
        }
      } catch (err) {
        console.debug('[useActionParam] Error procesando parámetro de acción:', err)
      }
    }

    // 1. Ejecutar de inmediato al montar
    checkAction()

    // 2. Micro-ticks para asegurar captura tras transiciones client-side de Next.js
    const t1 = setTimeout(checkAction, 40)
    const t2 = setTimeout(checkAction, 150)
    const t3 = setTimeout(checkAction, 400)
    const t4 = setTimeout(checkAction, 800)

    // 3. Interceptar pushState para capturar navegaciones instantáneas del router de Next.js
    const origPushState = window.history.pushState
    window.history.pushState = function (...args) {
      const res = origPushState.apply(this, args)
      checkAction()
      setTimeout(checkAction, 20)
      return res
    }

    // 4. Escuchar eventos de navegación del navegador y eventos personalizados de Casa
    window.addEventListener('popstate', checkAction)
    window.addEventListener('casa-action-param', checkAction)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      window.history.pushState = origPushState
      window.removeEventListener('popstate', checkAction)
      window.removeEventListener('casa-action-param', checkAction)
    }
  }, [])
}

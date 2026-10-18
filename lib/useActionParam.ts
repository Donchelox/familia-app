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
    function checkAction(customAction?: string) {
      if (typeof window === 'undefined') return
      try {
        let action = customAction
        if (!action) {
          const search = window.location.search || (window.location.href.includes('?') ? '?' + window.location.href.split('?')[1] : '')
          if (search) {
            const params = new URLSearchParams(search)
            action = params.get('action') || undefined
            if (action) {
              params.delete('action')
              const qs = params.toString()
              const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '')
              window.history.replaceState(window.history.state, '', cleanUrl)
            }
          }
        }

        if (action) {
          const handler = handlersRef.current[action]
          if (typeof handler === 'function') {
            handler()
          }
        }
      } catch (err) {
        console.debug('[useActionParam] Error procesando parámetro de acción:', err)
      }
    }

    // 1. Ejecutar de inmediato al montar
    checkAction()

    // 2. Micro-ticks para asegurar captura tras transiciones client-side de Next.js
    const t1 = setTimeout(() => checkAction(), 40)
    const t2 = setTimeout(() => checkAction(), 150)
    const t3 = setTimeout(() => checkAction(), 400)
    const t4 = setTimeout(() => checkAction(), 800)

    // 3. Interceptar pushState para capturar navegaciones instantáneas del router de Next.js
    const origPushState = window.history.pushState
    window.history.pushState = function (...args) {
      const res = origPushState.apply(this, args)
      checkAction()
      setTimeout(() => checkAction(), 20)
      return res
    }

    // 4. Escuchar eventos de navegación del navegador y eventos personalizados de Casa
    const handlePopState = () => checkAction()
    const handleCustomEvent = (e: Event) => {
      const detailAction = (e as CustomEvent)?.detail?.action
      checkAction(detailAction)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('casa-action-param', handleCustomEvent)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      window.history.pushState = origPushState
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('casa-action-param', handleCustomEvent)
    }
  }, [])
}

'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function PageProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()

  // Cuando la ruta o los parámetros cambian, la carga terminó
  useEffect(() => {
    setLoading(false)
  }, [pathname, searchParams])

  // Interceptar clicks en enlaces internos para feedback inmediato
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Buscar el elemento <a> más cercano
      const target = (e.target as HTMLElement)?.closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      // Ignorar enlaces externos, hashes, mailto, tel, descargas o nuevas pestañas
      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        target.getAttribute('target') === '_blank' ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return
      }

      // Si es la misma URL exacta (pathname + search), no iniciar loading
      const currentFullUrl = window.location.pathname + window.location.search
      if (href === currentFullUrl) return

      startTransition(() => {
        setLoading(true)
      })
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [])

  if (!loading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-1 bg-neutral-900/60 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#F76911] via-[#F2A957] to-[#F76911] animate-page-progress rounded-r-full shadow-[0_0_12px_rgba(247,105,17,0.7)]"
        style={{
          width: '100%',
        }}
      />
    </div>
  )
}

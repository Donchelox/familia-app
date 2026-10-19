'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]:', error)
  }, [error])

  return (
    <html lang="es">
      <body className="bg-[#131313] text-white min-h-screen flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl mb-4 shadow-lg">
          🏠
        </div>
        <h1 className="text-xl font-black text-white tracking-tight m-0">
          Reiniciando la aplicación
        </h1>
        <p className="text-xs text-neutral-400 mt-2 max-w-sm leading-relaxed">
          Hubo un problema al cargar la vista principal. Puedes reintentar o recargar la app.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-2xl bg-[#F76911] text-white text-xs font-bold shadow-md cursor-pointer hover:opacity-90 active:scale-95 transition-all"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className="px-5 py-2.5 rounded-2xl bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-bold cursor-pointer hover:bg-neutral-700 active:scale-95 transition-all"
          >
            Volver a inicio
          </button>
        </div>
      </body>
    </html>
  )
}

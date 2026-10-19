'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Error de aplicación]:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#131313] text-white flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-16 h-16 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl mb-4 shadow-lg">
        ⚠️
      </div>
      <h1 className="text-xl font-black text-white tracking-tight m-0">
        Ocurrió un inconveniente
      </h1>
      <p className="text-xs text-neutral-400 mt-2 max-w-sm leading-relaxed">
        No te preocupes, los datos de tu hogar están guardados de forma segura en tu dispositivo.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-2xl bg-[#F76911] text-white text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => window.location.href = '/'}
          className="px-5 py-2.5 rounded-2xl bg-neutral-800 border border-neutral-700/60 text-neutral-300 text-xs font-bold hover:bg-neutral-700 active:scale-95 transition-all cursor-pointer"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  )
}

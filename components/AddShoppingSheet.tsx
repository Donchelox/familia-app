'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { addItems } from '@/app/actions/shopping'

interface AddShoppingSheetProps {
  list: 'super' | 'feria'
}

export default function AddShoppingSheet({ list }: AddShoppingSheetProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')

  // Abre el sheet automáticamente si la URL viene con ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsOpen(true)
    }
  }, [searchParams])

  const isFeria = list === 'feria'
  const title = isFeria ? 'Añadir productos a la Feria' : 'Añadir productos al Súper'
  const placeholder = isFeria
    ? 'Ej: Tomates, Lechuga, Plátanos (uno por línea o separados por coma)'
    : 'Ej: Leche, Huevos, Pan, Café (uno por línea o separados por coma)'

  function handleClose() {
    setIsOpen(false)
    if (searchParams.get('action')) {
      router.replace(pathname, { scroll: false })
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!text.trim() || loading) return

    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      await addItems(formData)
      setText('')
      handleClose()
      router.refresh()
    } catch (err) {
      console.error(err)
      alert('Error al guardar productos. Revisa la consola.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botón flotante para abrir la hoja */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Añadir productos"
        style={{ background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)' }}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(247,105,17,0.4)] active:scale-95 transition-transform cursor-pointer border-2 border-white/20"
      >
        <svg className="w-8 h-8 stroke-white stroke-[2.5] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal / Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => !loading && handleClose()}
          />

          {/* Contenedor del Sheet */}
          <div className="relative w-full max-w-lg bg-[#161616] border border-neutral-800 rounded-t-[32px] sm:rounded-[32px] p-6 pb-10 sm:p-6 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{isFeria ? '🥬' : '🛒'}</span>
                <h2 className="text-lg font-bold text-white tracking-tight m-0">{title}</h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
              <input type="hidden" name="list" value={list} />

              <div className="flex flex-col gap-1.5">
                <label htmlFor="items" className="text-xs font-semibold text-neutral-400">
                  Productos
                </label>
                <textarea
                  id="items"
                  name="items"
                  rows={4}
                  required
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  disabled={loading}
                  className="w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911] focus:ring-1 focus:ring-[#F76911] resize-none transition-all"
                  autoFocus
                />
                <span className="text-[11px] text-neutral-500">
                  Puedes escribir varios ítems separados por saltos de línea o comas.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  style={{ background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)' }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer flex items-center gap-2"
                >
                  {loading && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {loading ? 'Guardando...' : 'Añadir productos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
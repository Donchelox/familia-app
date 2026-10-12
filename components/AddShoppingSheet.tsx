'use client'

import { useState } from 'react'
import { addItems } from '@/app/actions/shopping'

interface AddShoppingSheetProps {
  list: 'super' | 'feria'
}

export default function AddShoppingSheet({ list }: AddShoppingSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isFeria = list === 'feria'

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  return (
    <>
      {/* Botón flotante inferior derecho (+ Añadir) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={cardGradientStyle}
        className="fixed bottom-6 right-5 sm:right-[calc(50%-180px)] px-6 py-3 rounded-full font-bold text-sm text-white shadow-[0_6px_20px_rgba(247,105,17,0.4)] flex items-center gap-2 active:scale-95 transition-transform z-30"
      >
        <span className="text-lg leading-none">+</span>
        <span>Añadir</span>
      </button>

      {/* Backdrop y Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Fondo difuminado oscuro */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Contenedor del Bottom Sheet */}
          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
            {/* Manilla táctil superior */}
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">
                  {isFeria ? 'Añadir a la Feria' : 'Añadir al Supermercado'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {isFeria
                    ? 'Frutas, verduras, frutos secos...'
                    : 'Abarrotes, aseo, refrigerados...'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-[#242424] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form
              action={async (formData) => {
                await addItems(formData)
                setIsOpen(false)
              }}
              className="flex flex-col gap-4"
            >
              <input type="hidden" name="list" value={list} />
              <input
                name="name"
                type="text"
                autoFocus
                placeholder={
                  isFeria
                    ? 'Ej. 1kg paltas, limones, espinaca...'
                    : 'Ej. Leche descremada, pan, detergente...'
                }
                required
                className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-3.5 rounded-2xl bg-[#242424] text-neutral-300 font-bold text-sm active:scale-98 transition-transform"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={cardGradientStyle}
                  className="flex-[2] py-3.5 rounded-2xl text-white font-bold text-sm active:scale-98 transition-transform shadow-md"
                >
                  + Guardar producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
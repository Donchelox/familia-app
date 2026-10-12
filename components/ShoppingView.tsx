'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  addShoppingItem,
  updateShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
} from '@/app/actions/shopping'

type ShoppingItem = {
  id: string
  name: string
  done: boolean
}

interface ShoppingViewProps {
  title: string
  subtitle: string
  listType: 'super' | 'feria'
  items: ShoppingItem[]
  boughtItems: ShoppingItem[]
  canEdit: boolean
}

export default function ShoppingView({
  title,
  subtitle,
  listType,
  items,
  boughtItems,
  canEdit,
}: ShoppingViewProps) {
  // Estado para el Bottom Sheet: null (cerrado), 'add' (nuevo), o el objeto para editar
  const [activeItem, setActiveItem] = useState<'add' | ShoppingItem | null>(null)
  const [inputValue, setInputValue] = useState('')

  const openAdd = () => {
    setInputValue('')
    setActiveItem('add')
  }

  const openEdit = (item: ShoppingItem) => {
    setInputValue(item.name)
    setActiveItem(item)
  }

  const closeSheet = () => {
    setActiveItem(null)
    setInputValue('')
  }

  const cardGradientStyle = {
    background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
  }

  return (
    <div className="w-full flex flex-col gap-6 relative min-h-[calc(100vh-80px)] pb-28">
      {/* 1. HEADER CON FLECHA NARANJA Y CAMPANA */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="text-[#F76911] hover:opacity-80 transition-opacity p-1 no-underline flex items-center justify-center"
          >
            <svg className="w-7 h-7 stroke-current stroke-[3] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
        </div>

        <Link
          href="/notificaciones"
          aria-label="Notificaciones"
          className="relative p-2 text-white hover:opacity-80 transition-opacity no-underline"
        >
          <svg className="w-6 h-6 stroke-white stroke-2 fill-none" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F76911] rounded-full ring-2 ring-[#131313]" />
        </Link>
      </header>

      {/* 2. LISTA DE PRODUCTOS PENDIENTES */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#F76911]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <h2 className="text-base font-bold text-white tracking-tight">{subtitle}</h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-400 text-xs">
            No tienes productos pendientes. Pulsa + Añadir para crear uno.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between border-b border-neutral-800/40"
              >
                {/* Checkbox a la izquierda + Textos */}
                <div className="flex items-center gap-3.5 flex-1 pr-3">
                  <form action={toggleShoppingItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value="false" />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      aria-label={`Marcar ${item.name} como comprado`}
                      className="w-6 h-6 rounded-lg border-2 border-neutral-700 bg-[#171717] hover:border-[#F76911] flex items-center justify-center transition-all cursor-pointer"
                    />
                  </form>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-snug">
                      {item.name}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">Por comprar</span>
                  </div>
                </div>

                {/* Botón Editar que levanta el Bottom Sheet */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-sm font-bold text-[#F76911] hover:text-[#F2A957] transition-colors p-1"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. HISTORIAL DE "COMPRADOS" CON ESTILOS TAILWIND */}
      {boughtItems.length > 0 && (
        <section className="flex flex-col gap-3 mt-4 pt-4 border-t border-neutral-800/60">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Comprados ({boughtItems.length})
            </h3>
          </div>

          <div className="flex flex-col gap-1.5 bg-[#171717] border border-neutral-850 rounded-[20px] p-2.5">
            {boughtItems.map((item) => (
              <div
                key={item.id}
                className="py-2 px-2 flex items-center justify-between border-b border-neutral-800/30 last:border-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center gap-3 flex-1 pr-2">
                  {/* Botón check activo para restaurar */}
                  <form action={toggleShoppingItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value="true" />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      aria-label={`Restaurar ${item.name}`}
                      className="w-5 h-5 rounded-md bg-[#F76911] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 stroke-white stroke-[3] fill-none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </form>
                  <span className="text-sm font-medium text-neutral-300 line-through truncate">
                    {item.name}
                  </span>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-xs font-semibold text-neutral-400 hover:text-[#F76911] transition-colors p-1"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. BOTÓN FLOTANTE "+ AÑADIR" */}
      {canEdit && (
        <button
          type="button"
          onClick={openAdd}
          style={cardGradientStyle}
          className="fixed bottom-6 right-5 sm:right-[calc(50%-180px)] px-6 py-3 rounded-full font-bold text-sm text-white shadow-[0_6px_20px_rgba(247,105,17,0.4)] flex items-center gap-2 active:scale-95 transition-transform z-30 cursor-pointer"
        >
          <span className="text-lg leading-none">+</span>
          <span>Añadir</span>
        </button>
      )}

      {/* 5. BOTTOM SHEET FLOTANTE (AÑADIR / EDITAR / ELIMINAR) */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Fondo backdrop difuminado */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={closeSheet}
          />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
            {/* Manilla superior */}
            <div className="w-12 h-1.5 bg-neutral-700 rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white">
                  {activeItem === 'add' ? `Añadir a ${title}` : 'Editar artículo'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {activeItem === 'add'
                    ? 'Indica el producto o detalle a comprar.'
                    : 'Modifica el nombre o elimínalo de la lista.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSheet}
                className="w-8 h-8 rounded-full bg-[#242424] text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario guardar/editar */}
            <form
              action={async (formData) => {
                if (activeItem === 'add') {
                  await addShoppingItem(formData)
                } else {
                  await updateShoppingItem(formData)
                }
                closeSheet()
              }}
              className="flex flex-col gap-3.5"
            >
              <input type="hidden" name="list" value={listType} />
              {activeItem !== 'add' && <input type="hidden" name="id" value={activeItem.id} />}

              <input
                name="name"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                placeholder="Nombre del producto..."
                required
                className="w-full bg-[#131313] border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="flex-1 py-3.5 rounded-2xl bg-[#242424] text-neutral-300 font-bold text-sm active:scale-95 transition-transform cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={cardGradientStyle}
                  className="flex-[2] py-3.5 rounded-2xl text-white font-bold text-sm active:scale-95 transition-transform shadow-md cursor-pointer"
                >
                  {activeItem === 'add' ? '+ Guardar' : 'Actualizar'}
                </button>
              </div>
            </form>

            {/* Botón de eliminar dentro del Bottom Sheet al editar */}
            {activeItem !== 'add' && (
              <form
                action={async (formData) => {
                  await deleteShoppingItem(formData)
                  closeSheet()
                }}
                className="pt-1 border-t border-neutral-800/60"
              >
                <input type="hidden" name="id" value={activeItem.id} />
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-[#2a1616] text-red-400 font-bold text-xs hover:bg-[#381a1a] transition-colors cursor-pointer"
                >
                  Eliminar este producto
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
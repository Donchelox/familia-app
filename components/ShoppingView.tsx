'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
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
  subtitle?: string
  listType: 'super' | 'feria'
  items: ShoppingItem[]
  boughtItems: ShoppingItem[]
  canEdit: boolean
}

export default function ShoppingView({
  title,
  listType,
  items,
  boughtItems,
  canEdit,
}: ShoppingViewProps) {
  // Estado para el Bottom Sheet: null (cerrado), 'add' (nuevo), o ítem para editar
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

  const isFeria = listType === 'feria'

  return (
    <div className="w-full flex flex-col gap-5 relative min-h-[calc(100vh-80px)] pb-28">
      {/* 1. HEADER HOMOLOGADO */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al inicio"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-black tracking-tight text-white m-0">{title}</h1>
        </div>

        <NotificationBell />
      </header>

      {/* 2. TABS SEGMENTADOS PARA ALTERNAR ENTRE SÚPER Y FERIA */}
      <div className="flex p-1 bg-[#1c1c1c] rounded-2xl border border-neutral-800">
        <Link
          href="/super"
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all no-underline ${
            !isFeria
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Supermercado
        </Link>
        <Link
          href="/feria"
          className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all no-underline ${
            isFeria
              ? 'bg-pink-600 text-white shadow-md'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Feria
        </Link>
      </div>

      {/* 3. TÍTULO DE LA LISTA CON ICONO CORRESPONDIENTE AL HOME */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {isFeria ? (
            /* Icono Shopping Cart (Feria) */
            <svg className="w-5 h-5 stroke-[#F76911] stroke-[2.2] fill-none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          ) : (
            /* Icono Shopping Bag (Supermercado) */
            <svg className="w-5 h-5 stroke-[#F76911] stroke-[2.2] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          )}

          <h2 className="text-base font-bold text-white tracking-tight">
            {isFeria ? 'Lista de la feria' : 'Lista de supermercado'}
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="p-8 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-400 text-xs">
            {isFeria
              ? 'No tienes productos pendientes en la feria. Pulsa + Añadir para crear uno.'
              : 'No tienes productos pendientes en el supermercado. Pulsa + Añadir para crear uno.'}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between border-b border-neutral-800/40"
              >
                {/* Checkbox y Texto */}
                <div className="flex items-center gap-3.5 flex-1 pr-3">
                  <form
                    action={async (fd) => {
                      const res = await toggleShoppingItem(fd)
                      if (res && !res.ok) alert(res.error)
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value="false" />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      aria-label={`Marcar ${item.name} como comprado`}
                      className="w-6 h-6 rounded-lg border-2 border-neutral-700 bg-[#171717] hover:border-[#F76911] hover:scale-110 active:scale-90 flex items-center justify-center transition-all duration-150 cursor-pointer"
                    />
                  </form>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-white leading-snug">
                      {item.name}
                    </span>
                    <span className="text-xs text-neutral-400 font-medium">Por comprar</span>
                  </div>
                </div>

                {/* Botón Editar */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-sm font-bold text-[#F76911] hover:text-[#F2A957] hover:scale-105 active:scale-95 transition-all duration-150 p-1 cursor-pointer"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. HISTORIAL DE "COMPRADOS" */}
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
                  <form
                    action={async (fd) => {
                      const res = await toggleShoppingItem(fd)
                      if (res && !res.ok) alert(res.error)
                    }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="done" value="true" />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      aria-label={`Restaurar ${item.name}`}
                      className="w-5 h-5 rounded-md bg-[#F76911] flex items-center justify-center hover:scale-110 active:scale-90 transition-all duration-150 cursor-pointer"
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
                    className="text-xs font-semibold text-neutral-400 hover:text-[#F76911] hover:scale-105 active:scale-95 transition-all duration-150 p-1 cursor-pointer"
                  >
                    Editar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. BOTÓN FLOTANTE "+ AÑADIR" */}
      {canEdit && (
        <button
          type="button"
          onClick={openAdd}
          style={cardGradientStyle}
          className="fixed bottom-6 right-5 sm:right-[calc(50%-180px)] px-6 py-3 rounded-full font-bold text-sm text-white shadow-[0_6px_20px_rgba(247,105,17,0.4)] hover:shadow-[0_8px_25px_rgba(247,105,17,0.6)] flex items-center gap-2 hover:scale-105 active:scale-90 transition-all duration-200 z-30 cursor-pointer"
        >
          <span className="text-lg leading-none">+</span>
          <span>Añadir</span>
        </button>
      )}

      {/* 6. BOTTOM SHEET (AÑADIR / EDITAR / ELIMINAR) */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={closeSheet}
          />

          <div className="relative w-full max-w-[402px] bg-[#1a1a1a] rounded-t-[28px] border-t border-neutral-800 p-6 flex flex-col gap-4 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
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

            <form
              action={async (formData) => {
                const res =
                  activeItem === 'add'
                    ? await addShoppingItem(formData)
                    : await updateShoppingItem(formData)
                if (res && !res.ok) {
                  alert(res.error)
                  return
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

            {activeItem !== 'add' && (
              <form
                action={async (formData) => {
                  const res = await deleteShoppingItem(formData)
                  if (res && !res.ok) {
                    alert(res.error)
                    return
                  }
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
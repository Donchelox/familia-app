'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavProps {
  family?: string
  role?: string
}

export default function Nav({ family, role }: NavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // SOLO mostrar la barra de navegación en el dashboard principal ('/')
  if (pathname !== '/') {
    return null
  }

  const items = [
    {
      href: '/',
      label: 'Inicio',
      icon: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/super',
      label: 'Compras',
      icon: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      href: '/colegio',
      label: 'Colegio',
      icon: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
    },
    {
      href: '/meds',
      label: 'Medicina',
      icon: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
  ]

  const quickActions = [
    {
      label: 'Añadir nueva tarea colegio',
      href: '/colegio?action=new-homework',
      colorBg: 'bg-[#98F6B4]',
      colorText: 'text-[#064e26]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: 'Añadir nueva prueba',
      href: '/colegio?action=new-test',
      colorBg: 'bg-[#FCA5C0]',
      colorText: 'text-[#6b1129]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo medicamento',
      href: '/meds?action=new',
      colorBg: 'bg-[#A5C8FC]',
      colorText: 'text-[#102d6b]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo producto feria',
      href: '/feria?action=new',
      colorBg: 'bg-[#FDE28A]',
      colorText: 'text-[#714b09]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo producto super',
      href: '/super?action=new',
      colorBg: 'bg-[#FDBA74]',
      colorText: 'text-[#7c2d12]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nueva tarea',
      href: '/tareas?action=new',
      colorBg: 'bg-[#E9D5FF]',
      colorText: 'text-[#581c87]',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
  ]

  return (
    <>
      {/* BACKDROP OSCURO AL ABRIR EL MENÚ */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in"
        />
      )}

      {/* PANEL FLOTANTE DE ACCIONES RÁPIDAS */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 bottom-[88px] z-50 w-[92%] max-w-[370px] bg-[#161616] border border-neutral-800 rounded-[32px] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-1.5 transition-all duration-300 ease-out origin-bottom ${
          isOpen
            ? 'opacity-100 scale-100 pointer-events-auto translate-y-0'
            : 'opacity-0 scale-95 pointer-events-none translate-y-4'
        }`}
      >
        {quickActions.map((action, idx) => (
          <Link
            key={idx}
            href={action.href}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-2xl hover:bg-neutral-800/60 active:scale-[0.98] transition-all no-underline group cursor-pointer"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${action.colorBg} ${action.colorText}`}
            >
              {action.icon}
            </div>
            <span className="text-[13px] font-bold text-neutral-200 group-hover:text-white transition-colors">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#131313]/95 backdrop-blur-md border-t border-neutral-800/80 flex justify-center">
        <div className="w-full max-w-[402px] h-[76px] px-4 flex items-center justify-around relative">
          {/* Enlace Inicio */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-colors no-underline ${
              pathname === '/' && !isOpen ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[0].icon}
            <span className="text-[11px] font-bold">{items[0].label}</span>
          </Link>

          {/* Enlace Compras */}
          <Link
            href="/super"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-colors no-underline ${
              pathname.startsWith('/super') ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[1].icon}
            <span className="text-[11px] font-bold">{items[1].label}</span>
          </Link>

          {/* Botón Central Flotante '+' Interactivo */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
            style={{
              background: isOpen
                ? '#EF4444'
                : 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
            }}
            className="w-14 h-14 -mt-6 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(247,105,17,0.4)] active:scale-95 transition-all duration-300 cursor-pointer border-4 border-[#131313]"
          >
            <div
              className={`transition-transform duration-300 ${
                isOpen ? 'rotate-45' : 'rotate-0'
              }`}
            >
              <svg className="w-7 h-7 stroke-white stroke-[2.5] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>

          {/* Enlace Colegio */}
          <Link
            href="/colegio"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-colors no-underline ${
              pathname.startsWith('/colegio') ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[2].icon}
            <span className="text-[11px] font-bold">{items[2].label}</span>
          </Link>

          {/* Enlace Medicina */}
          <Link
            href="/meds"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-colors no-underline ${
              pathname.startsWith('/meds') ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[3].icon}
            <span className="text-[11px] font-bold">{items[3].label}</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
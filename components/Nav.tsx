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

  // El navbar SOLO debe aparecer en el dashboard (/)
  if (pathname !== '/') {
    return null
  }

  // Estado activo de cada ruta
  const isHomeActive = pathname === '/' && !isOpen
  const isComprasActive = (pathname.startsWith('/super') || pathname.startsWith('/feria')) && !isOpen
  const isColegioActive = pathname.startsWith('/colegio') && !isOpen
  const isMedsActive = pathname.startsWith('/meds') && !isOpen

  const items = [
    {
      href: '/',
      label: 'Inicio',
      isActive: isHomeActive,
      iconOutline: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      iconFilled: (
        <svg className="w-6 h-6 fill-current transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path d="M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.689z" />
          <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.432z" />
        </svg>
      ),
    },
    {
      href: '/super',
      label: 'Compras',
      isActive: isComprasActive,
      iconOutline: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      iconFilled: (
        <svg className="w-6 h-6 fill-current transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      href: '/colegio',
      label: 'Colegio',
      isActive: isColegioActive,
      iconOutline: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      iconFilled: (
        <svg className="w-6 h-6 fill-current transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path d="M11.7 2.805a.75.75 0 01.6 0A60.65 60.65 0 0122.83 8.72a.75.75 0 01-.231 1.337 49.949 49.949 0 00-9.902 3.912.75.75 0 01-.694 0 49.949 49.949 0 00-9.902-3.912.75.75 0 01-.231-1.337A60.653 60.653 0 0111.7 2.805z" />
          <path d="M13.06 15.473a48.455 48.455 0 017.666-3.282c.134 1.414.22 2.843.255 4.285a.75.75 0 01-.46.71 47.874 47.874 0 00-8.162 4.411.75.75 0 01-.798 0 47.874 47.874 0 00-8.162-4.411.75.75 0 01-.46-.71c.035-1.442.121-2.87.255-4.286A48.4 48.4 0 0110.94 15.473a2.25 2.25 0 002.12 0z" />
        </svg>
      ),
    },
    {
      href: '/meds',
      label: 'Medicina',
      isActive: isMedsActive,
      iconOutline: (
        <svg className="w-6 h-6 stroke-current stroke-2 fill-none transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
      iconFilled: (
        <svg className="w-6 h-6 fill-current transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
      ),
    },
  ]

  const quickActions = [
    {
      label: 'Añadir nueva tarea colegio',
      href: '/colegio?action=new-homework',
      colorBg: 'bg-purple-500/20',
      colorText: 'text-purple-300',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      label: 'Añadir nueva prueba',
      href: '/colegio?action=new-test',
      colorBg: 'bg-purple-500/20',
      colorText: 'text-purple-300',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo medicamento',
      href: '/meds?action=new',
      colorBg: 'bg-emerald-500/20',
      colorText: 'text-emerald-300',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo producto feria',
      href: '/feria?action=new',
      colorBg: 'bg-pink-500/20',
      colorText: 'text-pink-300',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nuevo producto super',
      href: '/super?action=new',
      colorBg: 'bg-sky-500/20',
      colorText: 'text-sky-300',
      icon: (
        <svg className="w-5 h-5 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: 'Añadir nueva tarea',
      href: '/tareas?action=new',
      colorBg: 'bg-orange-500/20',
      colorText: 'text-orange-300',
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
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
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
            className="flex items-center gap-3.5 px-3 py-2.5 rounded-2xl hover:bg-neutral-800/60 active:scale-[0.98] hover:translate-x-1 transition-all duration-150 no-underline group cursor-pointer"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-110 ${action.colorBg} ${action.colorText}`}
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
          {/* 1. Enlace Inicio */}
          <Link
            href="/"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-all duration-200 no-underline py-1 px-3 rounded-2xl active:scale-90 group relative cursor-pointer ${
              items[0].isActive ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[0].isActive ? items[0].iconFilled : items[0].iconOutline}
            <span className="text-[11px] font-bold">{items[0].label}</span>
            {items[0].isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F76911] shadow-[0_0_8px_#F76911] animate-in zoom-in-50 duration-200" />
            )}
          </Link>

          {/* 2. Enlace Compras */}
          <Link
            href="/super"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-all duration-200 no-underline py-1 px-3 rounded-2xl active:scale-90 group relative cursor-pointer ${
              items[1].isActive ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[1].isActive ? items[1].iconFilled : items[1].iconOutline}
            <span className="text-[11px] font-bold">{items[1].label}</span>
            {items[1].isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F76911] shadow-[0_0_8px_#F76911] animate-in zoom-in-50 duration-200" />
            )}
          </Link>

          {/* 3. Botón Central Flotante '+' Interactivo con Microinteracción de Rebote */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
            style={{
              background: isOpen
                ? '#EF4444'
                : 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)',
            }}
            className="w-14 h-14 -mt-6 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(247,105,17,0.4)] hover:shadow-[0_6px_28px_rgba(247,105,17,0.6)] hover:scale-105 active:scale-90 transition-all duration-200 ease-out cursor-pointer border-4 border-[#131313]"
          >
            <div
              className={`transition-transform duration-300 ease-out ${
                isOpen ? 'rotate-45 scale-110' : 'rotate-0 scale-100'
              }`}
            >
              <svg className="w-7 h-7 stroke-white stroke-[2.5] fill-none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </button>

          {/* 4. Enlace Colegio */}
          <Link
            href="/colegio"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-all duration-200 no-underline py-1 px-3 rounded-2xl active:scale-90 group relative cursor-pointer ${
              items[2].isActive ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[2].isActive ? items[2].iconFilled : items[2].iconOutline}
            <span className="text-[11px] font-bold">{items[2].label}</span>
            {items[2].isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F76911] shadow-[0_0_8px_#F76911] animate-in zoom-in-50 duration-200" />
            )}
          </Link>

          {/* 5. Enlace Medicina */}
          <Link
            href="/meds"
            onClick={() => setIsOpen(false)}
            className={`flex flex-col items-center gap-1 transition-all duration-200 no-underline py-1 px-3 rounded-2xl active:scale-90 group relative cursor-pointer ${
              items[3].isActive ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
            }`}
          >
            {items[3].isActive ? items[3].iconFilled : items[3].iconOutline}
            <span className="text-[11px] font-bold">{items[3].label}</span>
            {items[3].isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#F76911] shadow-[0_0_8px_#F76911] animate-in zoom-in-50 duration-200" />
            )}
          </Link>
        </div>
      </nav>
    </>
  )
}
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Nav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/95 backdrop-blur-md border-t border-neutral-900 px-3 py-2">
      <div className="max-w-md mx-auto flex items-center justify-between relative">
        
        {/* 1. Inicio */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive('/') ? 'text-[#ff6f24]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6 stroke-current stroke-[2] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[11px] font-medium mt-1">Inicio</span>
        </Link>

        {/* 2. Compras */}
        <Link
          href="/super"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive('/super') ? 'text-[#ff6f24]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6 stroke-current stroke-[2] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <span className="text-[11px] font-medium mt-1">Compras</span>
        </Link>

        {/* 3. Botón Flotante Central (+) */}
        <div className="flex-1 flex justify-center -mt-6">
          <Link
            href="/tareas" // O a un modal / acción para crear un elemento rápido
            aria-label="Añadir nuevo"
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#f25c19] via-[#ff6f24] to-[#ff8c37] flex items-center justify-center text-white shadow-[0_8px_20px_rgba(242,92,25,0.45)] border-4 border-[#121212] transition-transform active:scale-95"
          >
            <svg className="w-7 h-7 stroke-white stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </div>

        {/* 4. Colegio */}
        <Link
          href="/colegio"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive('/colegio') ? 'text-[#ff6f24]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6 stroke-current stroke-[2] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
          <span className="text-[11px] font-medium mt-1">Colegio</span>
        </Link>

        {/* 5. Medicina */}
        <Link
          href="/meds"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isActive('/meds') ? 'text-[#ff6f24]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <svg className="w-6 h-6 stroke-current stroke-[2] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-[11px] font-medium mt-1">Medicina</span>
        </Link>

      </div>
    </nav>
  )
}
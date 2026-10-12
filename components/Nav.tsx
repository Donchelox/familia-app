'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavProps {
  family?: string
  role?: string
}

export default function Nav({ family, role }: NavProps) {
  const pathname = usePathname()

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#131313]/90 backdrop-blur-md border-t border-neutral-800/80 flex justify-center">
      <div className="w-full max-w-[402px] h-[76px] px-4 flex items-center justify-around relative">
        {/* Enlace Inicio */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 transition-colors no-underline ${
            pathname === '/' ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {items[0].icon}
          <span className="text-[11px] font-bold">{items[0].label}</span>
        </Link>

        {/* Enlace Compras */}
        <Link
          href="/super"
          className={`flex flex-col items-center gap-1 transition-colors no-underline ${
            pathname.startsWith('/super') ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {items[1].icon}
          <span className="text-[11px] font-bold">{items[1].label}</span>
        </Link>

        {/* Botón Central Flotante '+' */}
        <Link
          href="/super"
          aria-label="Añadir rápido"
          style={{ background: 'linear-gradient(134.95deg, #F76911 47.75%, #F2A957 100%)' }}
          className="w-14 h-14 -mt-6 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(247,105,17,0.4)] active:scale-95 transition-transform no-underline"
        >
          <svg className="w-8 h-8 stroke-white stroke-[2.5] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </Link>

        {/* Enlace Colegio */}
        <Link
          href="/colegio"
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
          className={`flex flex-col items-center gap-1 transition-colors no-underline ${
            pathname.startsWith('/meds') ? 'text-[#F76911]' : 'text-neutral-400 hover:text-white'
          }`}
        >
          {items[3].icon}
          <span className="text-[11px] font-bold">{items[3].label}</span>
        </Link>
      </div>
    </nav>
  )
}
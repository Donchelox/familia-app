'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  ['/', 'Inicio', 'Inicio'],
  ['/super', 'Supermercado', 'Súper'],
  ['/meds', 'Medicamentos', 'Medicinas'],
  ['/tareas', 'Tareas', 'Tareas'],
  ['/colegio', 'Colegio', 'Colegio'],
  ['/ajustes', 'Ajustes', 'Ajustes'],
] as const

export default function Nav({ family, role }: { family: string; role: string }) {
  const path = usePathname()
  return (
    <nav className="side" aria-label="Menú principal">
      <p className="brand">{family}</p>
      <p className="who muted">{role}</p>
      {ITEMS.map(([href, full, short]) => (
        <Link key={href} href={href} aria-current={(href === '/' ? path === '/' : path.startsWith(href)) ? 'page' : undefined}>
          <span className="full">{full}</span><span className="sh">{short}</span>
        </Link>
      ))}
    </nav>
  )
}

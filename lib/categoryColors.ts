/**
 * Sistema centralizado de colores para labels, badges y accesos rápidos de la aplicación.
 * 
 * Mapeo de colores oficiales:
 * - Tareas: Naranjo (#EA580C / #F97316)
 * - Compras: Amarillo (#D97706 / #F59E0B)
 * - Medicinas: Verde (#059669 / #10B981)
 * - Súper: Azul (#0284C7 / #0EA5E9)
 * - Feria: Rosado (#DB2777 / #EC4899)
 * - Colegio: Púrpura (#7C3AED / #8B5CF6)
 */

export type CategoryId = 'tareas' | 'compras' | 'medicinas' | 'super' | 'feria' | 'colegio' | 'general'

export interface CategoryTheme {
  id: CategoryId
  label: string
  colorName: string
  // Clases para pills/etiquetas con fondo suave y borde
  badge: string
  // Clases para badges en el historial / registros
  historyBadge: string
  // Degradado CSS premium para tarjetas
  cardGradient: string
  // Resplandor / sombra en hover
  cardGlow: string
  // Clases para el contador blanco dentro de la tarjeta
  countBadge: string
  // Color hexadecimal principal
  accentHex: string
}

export const CATEGORY_THEMES: Record<CategoryId, CategoryTheme> = {
  tareas: {
    id: 'tareas',
    label: 'Tareas',
    colorName: 'naranjo',
    badge: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    historyBadge: 'bg-orange-950/40 text-orange-400 border-orange-900/40',
    cardGradient: 'linear-gradient(134.95deg, #EA580C 0%, #F97316 50%, #FB923C 100%)',
    cardGlow: 'rgba(249, 115, 22, 0.35)',
    countBadge: 'bg-white text-[#EA580C]',
    accentHex: '#F97316',
  },
  compras: {
    id: 'compras',
    label: 'Compras',
    colorName: 'amarillo',
    badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    historyBadge: 'bg-amber-950/40 text-amber-300 border-amber-900/40',
    cardGradient: 'linear-gradient(134.95deg, #D97706 0%, #F59E0B 50%, #FBBF24 100%)',
    cardGlow: 'rgba(245, 158, 11, 0.35)',
    countBadge: 'bg-white text-[#D97706]',
    accentHex: '#F59E0B',
  },
  medicinas: {
    id: 'medicinas',
    label: 'Medicinas',
    colorName: 'verde',
    badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    historyBadge: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40',
    cardGradient: 'linear-gradient(134.95deg, #059669 0%, #10B981 50%, #34D399 100%)',
    cardGlow: 'rgba(16, 185, 129, 0.35)',
    countBadge: 'bg-white text-[#059669]',
    accentHex: '#10B981',
  },
  super: {
    id: 'super',
    label: 'Súper',
    colorName: 'azul',
    badge: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
    historyBadge: 'bg-sky-950/40 text-sky-400 border-sky-900/40',
    cardGradient: 'linear-gradient(134.95deg, #0284C7 0%, #0EA5E9 50%, #38BDF8 100%)',
    cardGlow: 'rgba(14, 165, 233, 0.35)',
    countBadge: 'bg-white text-[#0284C7]',
    accentHex: '#0EA5E9',
  },
  feria: {
    id: 'feria',
    label: 'Feria',
    colorName: 'rosado',
    badge: 'bg-pink-500/15 text-pink-400 border border-pink-500/30',
    historyBadge: 'bg-pink-950/40 text-pink-400 border-pink-900/40',
    cardGradient: 'linear-gradient(134.95deg, #DB2777 0%, #EC4899 50%, #F472B6 100%)',
    cardGlow: 'rgba(236, 72, 153, 0.35)',
    countBadge: 'bg-white text-[#DB2777]',
    accentHex: '#EC4899',
  },
  colegio: {
    id: 'colegio',
    label: 'Colegio',
    colorName: 'purpura',
    badge: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    historyBadge: 'bg-purple-950/40 text-purple-400 border-purple-900/40',
    cardGradient: 'linear-gradient(134.95deg, #7C3AED 0%, #8B5CF6 50%, #A78BFA 100%)',
    cardGlow: 'rgba(139, 92, 246, 0.35)',
    countBadge: 'bg-white text-[#7C3AED]',
    accentHex: '#8B5CF6',
  },
  general: {
    id: 'general',
    label: 'General',
    colorName: 'neutral',
    badge: 'bg-neutral-800 text-neutral-300 border border-neutral-700',
    historyBadge: 'bg-neutral-800 text-neutral-300 border border-neutral-700',
    cardGradient: 'linear-gradient(134.95deg, #262626 0%, #404040 100%)',
    cardGlow: 'rgba(64, 64, 64, 0.35)',
    countBadge: 'bg-white text-neutral-800',
    accentHex: '#737373',
  },
}

/**
 * Resuelve el tema de color a partir de un identificador de categoría o módulo.
 */
export function getCategoryTheme(categoryOrModule?: string | null): CategoryTheme {
  if (!categoryOrModule) return CATEGORY_THEMES.general

  const norm = categoryOrModule
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (norm.includes('tarea') || norm.includes('todo') || norm === 'quehacer') {
    return CATEGORY_THEMES.tareas
  }

  if (norm === 'compras' || norm.includes('shopping')) {
    return CATEGORY_THEMES.compras
  }

  if (norm.includes('medicin') || norm.includes('medicamento') || norm.includes('dose') || norm === 'meds') {
    return CATEGORY_THEMES.medicinas
  }

  if (norm.includes('super')) {
    return CATEGORY_THEMES.super
  }

  if (norm.includes('feria')) {
    return CATEGORY_THEMES.feria
  }

  if (norm.includes('colegio') || norm.includes('school') || norm.includes('prueba') || norm.includes('examen')) {
    return CATEGORY_THEMES.colegio
  }

  return CATEGORY_THEMES.general
}

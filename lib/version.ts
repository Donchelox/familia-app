import pkg from '@/package.json'

export interface ReleaseInfo {
  version: string
  date: string
  type: 'major' | 'minor' | 'patch'
  title: string
  description: string
  highlights: string[]
}

/**
 * Registro de versiones según Semantic Versioning (SemVer: MAJOR.MINOR.PATCH):
 * - MAJOR: Cambios estructurales o incompatibles.
 * - MINOR: Nuevas funcionalidades compatibles hacia atrás (features).
 * - PATCH: Corrección de errores y pequeños ajustes (fixes).
 */
export const RELEASES: ReleaseInfo[] = [
  {
    version: '1.6.0',
    date: '2026-10-16',
    type: 'minor',
    title: 'Resolución de deuda técnica, tests unitarios y tolerancia a conflictos offline',
    description: 'Alineación total de esquema SQL, server actions con ActionResult, cron ligero con aislamiento por familia, tests Vitest y resolución LWW offline.',
    highlights: [
      'Esquema de base de datos idempotente alineado con todas las llamadas del código.',
      'Server actions tipadas uniformemente con ActionResult y compatibilidad con React 19.',
      'Cron de medicamentos y resúmenes optimizado con aislamiento de fallos y límite de concurrencia push.',
      'Resolución de conflictos offline con triggers updated_at, Dexie v3 y política Última Escritura Gana (LWW).',
      'Suite de 45 pruebas unitarias con Vitest y ejecución en CI.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-14',
    type: 'minor',
    title: 'Ajustes modulares, auditoría completa y selector de recurrencia',
    description: 'Reestructuración de la configuración familiar, auditoría en tiempo real y personalización de recordatorios.',
    highlights: [
      'Sub-páginas independientes en Ajustes: Integrantes, Preferencias e Historial.',
      'Auditoría y registro en vivo de creación, edición, eliminación y completados en todos los módulos.',
      'Selector de recurrencia para avisos de medicinas (5, 10, 15 o 30 minutos).',
      'Exportación del historial familiar formateado para asistentes de IA (.txt, .json y portapapeles).',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-14',
    type: 'minor',
    title: 'Dashboard inteligente, skeletons y traducción de errores',
    description: 'Mejoras en la experiencia visual inicial y unificación de mensajes.',
    highlights: [
      'Agrupación automática de listas de compras de Súper y Feria en filas únicas en el dashboard.',
      'Traducción completa de errores de autenticación y Supabase al español amigable.',
      'Homologación visual de encabezados y padding en la pantalla de notificaciones.',
      'Skeletons con efecto shimmer y barra de progreso fluida en transiciones de página.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-13',
    type: 'minor',
    title: 'Notificaciones push y recordatorios insistentes',
    description: 'Sistema proactivo para no olvidar medicamentos importantes.',
    highlights: [
      'Cron automatizado con reintentos para medicamentos sin confirmar.',
      'Suscripción web push directa en dispositivos móviles y de escritorio.',
      'Vinculación automática de invitaciones de adultos mediante código OTP.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-12',
    type: 'major',
    title: 'Lanzamiento inicial de Casa APP',
    description: 'Plataforma colaborativa para la organización integral del hogar.',
    highlights: [
      'Módulos de Tareas del hogar, Listas de Súper y Feria, Colegio y Medicamentos.',
      'Autenticación segura por código de un solo uso (OTP) y control de roles por familia.',
    ],
  },
]

export const APP_VERSION = pkg.version || '1.3.0'

export function getSemVerBreakdown(version: string = APP_VERSION) {
  const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10) || 0)
  return { major, minor, patch }
}

export function getCurrentRelease(): ReleaseInfo {
  return (
    RELEASES.find((r) => r.version === APP_VERSION) || {
      version: APP_VERSION,
      date: new Date().toISOString().split('T')[0],
      type: 'minor',
      title: 'Versión actual',
      description: 'Versión compilada según package.json',
      highlights: [],
    }
  )
}

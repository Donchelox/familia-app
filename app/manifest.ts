import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casa — Organización Familiar',
    short_name: 'Casa',
    description: 'Administración familiar y organización del hogar',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#131313',
    theme_color: '#131313',
    shortcuts: [
      {
        name: 'Medicamentos',
        url: '/meds',
        description: 'Ver y confirmar dosis de medicinas',
      },
      {
        name: 'Compras',
        url: '/super',
        description: 'Lista de supermercado y feria',
      },
      {
        name: 'Colegio',
        url: '/colegio',
        description: 'Horario escolar, tareas y pruebas',
      },
    ],
    icons: [
      {
        src: '/icon-192.webp',
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/icon-512.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/icon-512.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'maskable',
      },
    ],
  }
}
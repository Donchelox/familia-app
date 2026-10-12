import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casa — Organización Familiar',
    short_name: 'Casa',
    description: 'Administración familiar y organización del hogar',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1722', // O '#CDF6F9' si quieres que el fondo del splash nativo sea claro
    theme_color: '#CDF6F9',      // Color de la barra de estado en Android
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
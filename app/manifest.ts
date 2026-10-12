import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Casa — Organización Familiar',
    short_name: 'Casa',
    description: 'Administración familiar y organización del hogar',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1722',
    theme_color: '#1f4e8c',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
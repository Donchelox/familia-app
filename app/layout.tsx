import type { Metadata, Viewport } from 'next'
import './globals.css'

import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#131313',
}

export const metadata: Metadata = {
  title: 'Casa',
  description: 'Organización familiar',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.webp',
    apple: '/icon-192.png', // iOS usa este ícono al instalar la app
  },
}

export const viewport: Viewport = {
  themeColor: '#CDF6F9', // Color de la barra de estado y navegación en Android
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=Figtree:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
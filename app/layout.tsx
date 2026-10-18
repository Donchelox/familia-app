import type { Metadata, Viewport } from 'next'
import './globals.css'
import PreventContextMenu from '@/components/PreventContextMenu'
import PWARegister from '@/components/PWARegister'
import { Analytics } from '@vercel/analytics/react'

export const viewport: Viewport = {
  themeColor: '#131313',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Casa',
  description: 'Organización familiar',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.webp',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-[#131313] text-white" suppressHydrationWarning>
        <PWARegister />
        <PreventContextMenu />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
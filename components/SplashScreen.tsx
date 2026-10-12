'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true)
  const [fade, setFade] = useState(false)

  useEffect(() => {
    // Si no es la primera carga de la sesión, no lo mostramos de nuevo
    const hasSeenSplash = sessionStorage.getItem('casa_splash_seen')
    if (hasSeenSplash) {
      setShowSplash(false)
      return
    }

    // Iniciar desvanecimiento a los 1.6 segundos
    const timerFade = setTimeout(() => setFade(true), 1600)
    // Desmontar el splash a los 2.0 segundos
    const timerHide = setTimeout(() => {
      setShowSplash(false)
      sessionStorage.setItem('casa_splash_seen', 'true')
    }, 2000)

    return () => {
      clearTimeout(timerFade)
      clearTimeout(timerHide)
    }
  }, [])

  return (
    <>
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#0f1722',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: fade ? 0 : 1,
            transition: 'opacity 0.4s ease-out',
            pointerEvents: fade ? 'none' : 'auto',
          }}
        >
          <Image
            src="/splash-art.webp"
            alt="Bienvenido a Casa"
            fill
            priority
            style={{ objectFit: 'cover' }}
          />
        </div>
      )}
      {children}
    </>
  )
}
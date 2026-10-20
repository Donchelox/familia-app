'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  today: string
  userId?: string
  initialDismissed?: boolean
}

export default function MorningSummaryBanner({
  today,
  userId,
  initialDismissed = false,
}: Props) {
  const [isDismissed, setIsDismissed] = useState<boolean>(initialDismissed)

  const storageKey = userId
    ? `resumen_visto_${userId}_${today}`
    : `resumen_visto_anon_${today}`

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey)
      if (stored === '1') {
        setIsDismissed(true)
      }
    }
  }, [storageKey])

  const handleClick = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, '1')
        document.cookie = `${storageKey}=1; path=/; max-age=86400; SameSite=Lax`
      } catch (err) {
        console.error('Error saving summary view state', err)
      }
    }
    setIsDismissed(true)
  }

  if (isDismissed) {
    return null
  }

  return (
    <Link
      href="/resumen"
      onClick={handleClick}
      className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#24150b] via-[#1a1410] to-[#161616] border border-[#F76911]/30 hover:border-[#F76911]/60 shadow-sm text-white no-underline transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] group cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#F76911]/20 border border-[#F76911]/40 flex items-center justify-center text-lg shrink-0 transition-transform duration-200 group-hover:scale-110">
          🌅
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black tracking-tight text-white group-hover:text-[#F2A957] transition-colors">
              Este día tienes...
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F76911]/20 text-[#F2A957] font-bold">
              Hoy
            </span>
          </div>
          <span className="text-[11px] text-neutral-400 font-medium">
            Toca para ver el resumen completo de tu día
          </span>
        </div>
      </div>

      <div className="text-[#F76911] transition-transform duration-200 group-hover:translate-x-1">
        <svg className="w-5 h-5 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

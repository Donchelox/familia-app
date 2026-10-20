'use client'

import { useEffect } from 'react'

interface Props {
  today: string
  userId?: string
}

export default function MarkSummaryVisited({ today, userId }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const storageKey = userId
      ? `resumen_visto_${userId}_${today}`
      : `resumen_visto_anon_${today}`

    try {
      localStorage.setItem(storageKey, '1')
      document.cookie = `${storageKey}=1; path=/; max-age=86400; SameSite=Lax`
    } catch (err) {
      console.error('Error marking summary as visited', err)
    }
  }, [today, userId])

  return null
}

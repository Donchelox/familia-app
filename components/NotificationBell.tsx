'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { countUnread, onHistoryChange } from '@/lib/pushHistory'

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0)

  useEffect(() => {
    let active = true
    const update = () => {
      countUnread()
        .then((n) => active && setUnreadCount(n))
        .catch(() => active && setUnreadCount(0))
    }
    update()
    const off = onHistoryChange(update)
    return () => {
      active = false
      off()
    }
  }, [])

  return (
    <Link
      href="/notificaciones"
      aria-label="Ver historial de notificaciones"
      className="relative p-2.5 rounded-full bg-[#1e1e1e] border border-neutral-800 text-white hover:text-white transition-colors no-underline"
    >
      <svg className="w-5 h-5 stroke-white stroke-2 fill-none" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#F76911] text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-[#131313]">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
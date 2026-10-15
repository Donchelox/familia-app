'use client'

import { useState, useEffect } from 'react'
import { useOfflineSync } from '@/lib/offline/useOfflineSync'

interface SyncStatusBadgeProps {
  className?: string
  showLabel?: boolean
}

/**
 * Micro-indicador de red y sincronización modular para la cabecera
 * Proporciona retroalimentación visual inmediata sobre el estado de la conexión
 * y cambios pendientes en Dexie.js.
 */
export default function SyncStatusBadge({
  className = '',
  showLabel = false,
}: SyncStatusBadgeProps) {
  const [mounted, setMounted] = useState(false)
  const { isOnline, isSyncing, pendingCount, syncNow } = useOfflineSync()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Antes de que el cliente monte completamente, renderizar la representación consistente con SSR
  if (!mounted) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-neutral-400 opacity-60 ${className}`}
      >
        <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l2 2 4-4" />
        </svg>
        {showLabel && (
          <span className="text-[10px] font-bold text-neutral-400 tracking-tight">
            Sincronizado
          </span>
        )}
      </div>
    )
  }

  // 1. ESTADO: SIN CONEXIÓN (OFFLINE)
  if (!isOnline) {
    return (
      <button
        type="button"
        onClick={() => syncNow()}
        title={`Sin conexión. ${pendingCount} cambio(s) guardado(s) localmente en Dexie.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-900/50 text-amber-400 hover:border-amber-700/60 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm ${className}`}
      >
        {/* Icono de Nube Desconectada */}
        <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        </svg>

        <span className="text-[10px] font-bold tracking-tight">
          Offline {pendingCount > 0 ? `(${pendingCount})` : ''}
        </span>
      </button>
    )
  }

  // 2. ESTADO: SINCRONIZANDO CAMBIOS PENDIENTES
  if (isSyncing) {
    return (
      <div
        title="Sincronizando cambios locales con Supabase..."
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-950/40 border border-[#F76911]/50 text-[#F76911] shadow-[0_0_12px_rgba(247,105,17,0.25)] animate-in fade-in duration-150 ${className}`}
      >
        {/* Icono de Flechas Giratorias */}
        <svg className="w-3.5 h-3.5 stroke-current stroke-[2.5] fill-none animate-spin" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>

        <span className="text-[10px] font-bold tracking-tight">
          Sincronizando {pendingCount > 0 ? `(${pendingCount})` : ''}
        </span>
      </div>
    )
  }

  // 3. ESTADO: ONLINE CON MUTACIONES PENDIENTES (EN COLA)
  if (pendingCount > 0) {
    return (
      <button
        type="button"
        onClick={() => syncNow()}
        title={`${pendingCount} cambio(s) pendiente(s). Toca para sincronizar ahora.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-950/30 border border-orange-900/40 text-[#F2A957] hover:border-[#F76911] hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer shadow-sm ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#F76911] animate-pulse" />
        <span className="text-[10px] font-bold tracking-tight">
          {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
        </span>
      </button>
    )
  }

  // 4. ESTADO: ONLINE Y 100% SINCRONIZADO
  return (
    <button
      type="button"
      onClick={() => syncNow()}
      title="Todo sincronizado con Supabase"
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-emerald-400 hover:border-emerald-900/60 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer ${className}`}
    >
      {/* Icono Nube con Check */}
      <svg className="w-3.5 h-3.5 stroke-current stroke-2 fill-none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l2 2 4-4" />
      </svg>

      {showLabel && (
        <span className="text-[10px] font-bold text-neutral-400 tracking-tight">
          Sincronizado
        </span>
      )}
    </button>
  )
}

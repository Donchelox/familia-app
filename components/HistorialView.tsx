'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotificationBell from '@/components/NotificationBell'
import { clearLog } from '@/app/actions/family'

export interface ActivityLogRow {
  id: number
  family_id: string
  user_name: string | null
  module: string
  action: string
  item: string | null
  created_at: string
}

interface HistorialViewProps {
  familyId: string
  initialLogs: ActivityLogRow[]
  isAdmin?: boolean
}

export default function HistorialView({
  familyId,
  initialLogs,
  isAdmin = false,
}: HistorialViewProps) {
  const [logs, setLogs] = useState<ActivityLogRow[]>(initialLogs)
  const [selectedModule, setSelectedModule] = useState<string>('todos')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Mapear módulos a nombres e iconos
  function getModuleBadge(module: string) {
    const mod = (module || '').toLowerCase()
    switch (mod) {
      case 'medicinas':
      case 'medication':
      case 'dose':
        return { label: '💊 Medicinas', color: 'bg-cyan-950/40 text-cyan-400 border-cyan-900/40' }
      case 'colegio':
      case 'school_test':
      case 'school_homework':
      case 'school_schedule':
        return { label: '🎒 Colegio', color: 'bg-orange-950/40 text-[#F76911] border-orange-900/40' }
      case 'supermercado':
      case 'shopping':
      case 'compras':
        return { label: '🛒 Supermercado', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' }
      case 'feria':
        return { label: '🥬 Feria', color: 'bg-lime-950/40 text-lime-400 border-lime-900/40' }
      case 'tareas':
      case 'todo':
        return { label: '✅ Tareas', color: 'bg-amber-950/40 text-amber-400 border-amber-900/40' }
      case 'familia':
      case 'member':
        return { label: '👥 Familia', color: 'bg-purple-950/40 text-purple-400 border-purple-900/40' }
      default:
        return { label: '⚙️ General', color: 'bg-neutral-800 text-neutral-300 border-neutral-700' }
    }
  }

  // Mapear tipos de acciones a colores
  function getActionBadge(action: string) {
    const act = (action || '').toLowerCase()
    if (act.includes('añadid') || act.includes('cread') || act.includes('agendad')) {
      return { label: action, color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' }
    }
    if (act.includes('completad') || act.includes('comprado') || act.includes('tomada') || act.includes('hecha')) {
      return { label: action, color: 'bg-blue-950/40 text-blue-400 border-blue-900/40' }
    }
    if (act.includes('editad') || act.includes('actualizad')) {
      return { label: action, color: 'bg-amber-950/40 text-amber-400 border-amber-900/40' }
    }
    if (act.includes('eliminad') || act.includes('vaciad')) {
      return { label: action, color: 'bg-red-950/40 text-red-400 border-red-900/40' }
    }
    if (act.includes('desmarcad') || act.includes('pendiente') || act.includes('restaurad')) {
      return { label: action, color: 'bg-orange-950/40 text-[#F2A957] border-orange-900/40' }
    }
    return { label: action, color: 'bg-neutral-800 text-neutral-300 border-neutral-700' }
  }

  // Filtrado reactivo
  const filteredLogs = logs.filter((log) => {
    if (selectedModule !== 'todos') {
      const mod = (log.module || '').toLowerCase()
      if (selectedModule === 'supermercado' && mod !== 'supermercado') return false
      if (selectedModule === 'feria' && mod !== 'feria') return false
      if (selectedModule === 'tareas' && mod !== 'tareas') return false
      if (selectedModule === 'medicinas' && mod !== 'medicinas') return false
      if (selectedModule === 'colegio' && mod !== 'colegio') return false
      if (selectedModule === 'familia' && mod !== 'familia') return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchItem = (log.item || '').toLowerCase().includes(q)
      const matchAction = (log.action || '').toLowerCase().includes(q)
      const matchActor = (log.user_name || '').toLowerCase().includes(q)
      const matchModule = (log.module || '').toLowerCase().includes(q)
      return matchItem || matchAction || matchActor || matchModule
    }

    return true
  })

  // Exportar para la IA
  function formatLogsForAI(): string {
    if (filteredLogs.length === 0) return 'Sin registros de actividad.'

    let text = `# HISTORIAL DE ACTIVIDAD & AUDITORÍA FAMILIAR\n`
    text += `Fecha de exportación: ${new Date().toLocaleString('es-CL')}\n`
    text += `Total de movimientos registrados: ${filteredLogs.length}\n\n`
    text += `| Fecha y Hora | Quién lo realizó | Módulo | Acción | Detalle del Ítem |\n`
    text += `|---|---|---|---|---|\n`

    filteredLogs.forEach((log) => {
      const dateStr = new Date(log.created_at).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      text += `| ${dateStr} | ${log.user_name || 'Familiar'} | ${log.module} | ${log.action} | ${log.item || 'Sin detalle'} |\n`
    })

    return text
  }

  function copyToClipboard() {
    const text = formatLogsForAI()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function downloadFile(type: 'json' | 'txt') {
    let content = ''
    let mimeType = ''
    let filename = `auditoria_familia_${new Date().toISOString().split('T')[0]}`

    if (type === 'json') {
      content = JSON.stringify(filteredLogs, null, 2)
      mimeType = 'application/json'
      filename += '.json'
    } else {
      content = formatLogsForAI()
      mimeType = 'text/plain'
      filename += '.txt'
    }

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full flex flex-col gap-5 relative min-h-[calc(100vh-80px)] pb-16 select-none">
      {/* 1. HEADER */}
      <header className="flex items-center justify-between py-1">
        <div className="flex items-center gap-3">
          <Link
            href="/ajustes"
            aria-label="Volver a ajustes"
            className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-[#F76911] hover:bg-neutral-800/60 active:scale-95 transition-all cursor-pointer no-underline"
          >
            <svg className="w-7 h-7 stroke-current stroke-[2.5] fill-none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white m-0">Historial y Auditoría</h1>
            <p className="text-xs text-neutral-400 font-medium m-0">
              {logs.length} movimientos registrados en la familia
            </p>
          </div>
        </div>

        <NotificationBell />
      </header>

      {/* 2. BOTONES DE EXPORTACIÓN */}
      <section className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={copyToClipboard}
          className="py-2.5 px-2 rounded-2xl bg-[#1a1a1a] border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80 hover:scale-105 active:scale-95 text-neutral-200 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span>{copied ? '✓ Copiado' : '📋 Copiar para IA'}</span>
        </button>

        <button
          type="button"
          onClick={() => downloadFile('txt')}
          className="py-2.5 px-2 rounded-2xl bg-[#1a1a1a] border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80 hover:scale-105 active:scale-95 text-neutral-200 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span>📥 Texto (.txt)</span>
        </button>

        <button
          type="button"
          onClick={() => downloadFile('json')}
          className="py-2.5 px-2 rounded-2xl bg-[#1a1a1a] border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/80 hover:scale-105 active:scale-95 text-neutral-200 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span>⚙️ JSON</span>
        </button>
      </section>

      {/* 3. BARRA DE BÚSQUEDA */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por producto, tarea, medicina o familiar..."
          className="w-full bg-[#1a1a1a] border border-neutral-800 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#F76911]"
        />
        <svg className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-3 text-neutral-400 hover:text-white hover:scale-110 active:scale-90 transition-all duration-150 text-xs cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* 4. CHIPS DE FILTRO POR MÓDULO */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'todos', label: 'Todos' },
          { id: 'tareas', label: 'Tareas' },
          { id: 'supermercado', label: 'Súper' },
          { id: 'feria', label: 'Feria' },
          { id: 'medicinas', label: 'Medicinas' },
          { id: 'colegio', label: 'Colegio' },
          { id: 'familia', label: 'Familia' },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSelectedModule(chip.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
              selectedModule === chip.id
                ? 'bg-[#F76911] text-white shadow'
                : 'bg-[#1a1a1a] border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 5. LISTA DE MOVIMIENTOS */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'registro' : 'registros'}
          </span>

          {isAdmin && logs.length > 0 && (
            <form
              action={async () => {
                if (!confirm('¿Seguro que deseas vaciar todo el registro de auditoría de la familia?')) return
                await clearLog()
                setLogs([])
              }}
            >
              <button
                type="submit"
                className="text-xs font-bold text-red-400 hover:text-red-300 hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer"
              >
                Vaciar historial
              </button>
            </form>
          )}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-10 rounded-[24px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-500 text-xs">
            No se encontraron movimientos registrados con estos filtros.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getModuleBadge(log.module)
            const actBadge = getActionBadge(log.action)
            const dateObj = new Date(log.created_at)
            const formattedDate = dateObj.toLocaleDateString('es-CL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
            const formattedTime = dateObj.toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={log.id}
                className="p-3.5 rounded-[20px] bg-[#1a1a1a] border border-neutral-800/80 flex flex-col gap-2 shadow-sm hover:border-neutral-700/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold capitalize ${actBadge.color}`}>
                      {actBadge.label}
                    </span>
                    <span className="text-xs font-semibold text-neutral-300">
                      👤 {log.user_name || 'Familiar'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                    <span className="text-white font-bold capitalize">{formattedDate}</span>
                    <span>a las</span>
                    <span className="text-white font-bold">{formattedTime}</span>
                  </div>
                </div>

                <p className="text-xs text-neutral-200 m-0 font-medium leading-snug">
                  {log.item || 'Sin detalle adicional'}
                </p>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}

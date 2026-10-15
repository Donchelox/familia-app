// components/LogPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCategoryTheme } from '@/lib/categoryColors'

interface LogItem {
  id: string
  action: string
  entity: string
  actor: string
  title: string
  scheduledAt?: string | null
  editedAt: string // Día y hora exacta de la edición
}

interface LogPanelProps {
  familyId: string
}

export default function LogPanel({ familyId }: LogPanelProps) {
  const supabase = createClient()
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Mapear entidades a nombres amigables con icono
  function getEntityBadge(entity: string) {
    switch (entity) {
      case 'medication':
      case 'dose':
      case 'medicinas':
        return { label: '💊 Medicinas', color: getCategoryTheme('medicinas').historyBadge }
      case 'school_test':
      case 'school_homework':
      case 'school_schedule':
      case 'colegio':
        return { label: '🎒 Colegio', color: getCategoryTheme('colegio').historyBadge }
      case 'super':
      case 'supermercado':
        return { label: '🛒 Súper', color: getCategoryTheme('super').historyBadge }
      case 'shopping':
      case 'compras':
        return { label: '🛍️ Compras', color: getCategoryTheme('compras').historyBadge }
      case 'feria':
        return { label: '🥬 Feria', color: getCategoryTheme('feria').historyBadge }
      case 'todo':
      case 'tareas':
        return { label: '✅ Tareas', color: getCategoryTheme('tareas').historyBadge }
      default:
        return { label: '⚙️ General', color: 'bg-neutral-800 text-neutral-300 border-neutral-700' }
    }
  }

  function getActionLabel(action: string) {
    switch (action) {
      case 'create':
        return 'Creación'
      case 'update':
        return 'Edición'
      case 'delete':
        return 'Eliminación'
      case 'toggle':
        return 'Cambio de estado'
      default:
        return action
    }
  }

  async function loadLogs() {
    if (!familyId) return
    setLoading(true)

    try {
      const items: LogItem[] = []
      const seenEntities = new Set<string>()

      // 1. Cargar auditoría explícita desde change_logs
      const { data: dbLogs } = await supabase
        .from('change_logs')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false })
        .limit(200)

      if (dbLogs && dbLogs.length > 0) {
        dbLogs.forEach((row: any) => {
          const d = row.details || {}

          // Resuelve título tanto si viene de recordActivity como de inserts directos
          let title = d.title
          if (!title) {
            if (row.entity === 'medication') {
              title = `Medicamento: ${d.name || 'Sin nombre'} (${d.dose || 'dosis estándar'})`
            } else if (row.entity === 'dose') {
              title = `Dosis: ${d.name || 'Medicamento'}`
            } else if (row.entity === 'shopping') {
              title = `Compra: ${d.name || 'Artículo'}`
            } else if (row.entity === 'todo') {
              title = `Tarea: ${d.title || 'Pendiente'}`
            } else {
              title = `Registro de ${row.entity}`
            }
          }

          let scheduledAt = d.scheduled_at || d.scheduledAt
          if (!scheduledAt && d.times) {
            scheduledAt = `Horarios: ${d.times.join(', ')} hrs`
          } else if (!scheduledAt && d.doseTime) {
            scheduledAt = `A las ${d.doseTime} hrs`
          }

          items.push({
            id: `cl-${row.id}`,
            entity: row.entity || 'general',
            action: row.action || 'update',
            actor: row.actor_name || 'Familiar',
            title,
            scheduledAt: scheduledAt || null,
            editedAt: row.created_at,
          })

          if (row.entity_id) {
            seenEntities.add(`${row.entity}-${row.entity_id}`)
          }
        })
      }

      // 2. Traer registros existentes en paralelo para complementar los que no tengan log en change_logs
      const [medsRes, testsRes, hwRes, todosRes, shopRes] = await Promise.all([
        supabase.from('medications').select('*').eq('family_id', familyId),
        supabase.from('school_tests').select('*').eq('family_id', familyId),
        supabase.from('school_homework').select('*').eq('family_id', familyId),
        supabase.from('todos').select('*').eq('family_id', familyId).limit(50),
        supabase.from('shopping_items').select('*').eq('family_id', familyId).limit(50),
      ])

      // A) Medicamentos
      medsRes.data?.forEach((m: any) => {
        if (!seenEntities.has(`medication-${m.id}`)) {
          items.push({
            id: `med-${m.id}`,
            entity: 'medication',
            action: 'create',
            actor: m.person || 'Familia',
            title: `Medicamento: ${m.name} (${m.dose || 'dosis estándar'})`,
            scheduledAt: `Horarios: ${(m.times || []).join(', ')} hrs`,
            editedAt: m.created_at || new Date().toISOString(),
          })
        }
      })

      // B) Pruebas escolares
      testsRes.data?.forEach((t: any) => {
        if (!seenEntities.has(`school_test-${t.id}`)) {
          items.push({
            id: `test-${t.id}`,
            entity: 'school_test',
            action: 'create',
            actor: 'Colegio',
            title: `Evaluación de ${t.subject}${t.topic ? `: ${t.topic}` : ''}`,
            scheduledAt: t.test_date ? `Fecha agendada: ${t.test_date}` : null,
            editedAt: t.created_at || new Date().toISOString(),
          })
        }
      })

      // C) Tareas escolares
      hwRes.data?.forEach((h: any) => {
        if (!seenEntities.has(`school_homework-${h.id}`)) {
          items.push({
            id: `hw-${h.id}`,
            entity: 'school_homework',
            action: h.done ? 'toggle' : 'create',
            actor: 'Colegio',
            title: `Tarea escolar: ${h.title || h.subject || 'Sin título'}`,
            scheduledAt: h.due_date ? `Entrega: ${h.due_date}` : null,
            editedAt: h.created_at || new Date().toISOString(),
          })
        }
      })

      // D) Tareas del hogar
      todosRes.data?.forEach((td: any) => {
        if (!seenEntities.has(`todo-${td.id}`)) {
          items.push({
            id: `todo-${td.id}`,
            entity: 'todo',
            action: td.done ? 'toggle' : 'create',
            actor: td.assigned_to || 'Hogar',
            title: `Tarea: ${td.title}`,
            scheduledAt: td.due_date ? `Límite: ${td.due_date}` : null,
            editedAt: td.done_at || td.created_at || new Date().toISOString(),
          })
        }
      })

      // E) Lista de compras (Súper y Feria)
      shopRes.data?.forEach((s: any) => {
        if (!seenEntities.has(`shopping-${s.id}`)) {
          const isFeria = (s.list || s.location || '').toLowerCase() === 'feria'
          const area = isFeria ? 'Feria' : 'Súper'
          items.push({
            id: `shop-${s.id}`,
            entity: isFeria ? 'feria' : 'super',
            action: s.done ? 'toggle' : 'create',
            actor: 'Compras',
            title: `Producto: ${s.name} (${area})`,
            scheduledAt: s.category ? `Categoría: ${s.category}` : null,
            editedAt: s.created_at || new Date().toISOString(),
          })
        }
      })

      // Ordenar por fecha y hora más reciente
      items.sort((a, b) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime())
      setLogs(items)
    } catch (err) {
      console.error('Error cargando logs:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (familyId) loadLogs()
  }, [familyId])

  // Formato Markdown limpio y cronológico para pasarle a la IA
  function formatLogsForAI(): string {
    if (logs.length === 0) return 'Sin registros de actividad.'

    let text = `# HISTORIAL DE AUDITORÍA Y ACTIVIDAD FAMILIAR\n`
    text += `Fecha de exportación: ${new Date().toLocaleString('es-CL')}\n`
    text += `Total de movimientos registrados: ${logs.length}\n\n`
    text += `| Fecha y Hora de Edición | Quién Editó | Área | Tipo de Acción | Detalle del Elemento | Horario / Fecha Programada |\n`
    text += `|---|---|---|---|---|---|\n`

    logs.forEach((log) => {
      const editDate = new Date(log.editedAt).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const scheduled = log.scheduledAt || 'Inmediato / No aplica'
      text += `| ${editDate} | ${log.actor} | ${log.entity} | ${getActionLabel(log.action)} | ${log.title} | ${scheduled} |\n`
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
      content = JSON.stringify(logs, null, 2)
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
    <div className="w-full bg-[#1a1a1a] border border-neutral-800/80 rounded-[28px] p-5 shadow-lg flex flex-col gap-4">
      {/* CABECERA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-950/40 border border-orange-900/40 text-[#F76911] flex items-center justify-center text-sm font-bold">
            📋
          </div>
          <div>
            <h2 className="text-base font-bold text-white m-0">
              Historial de Actividad & Auditoría
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5 m-0">
              Registro completo de ediciones y horarios para la IA
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const next = !isOpen
            setIsOpen(next)
            if (next) loadLogs()
          }}
          className="text-xs font-bold text-[#F76911] hover:underline cursor-pointer px-2 py-1"
        >
          {isOpen ? 'Ocultar' : `Ver registros (${logs.length})`}
        </button>
      </div>

      {/* BOTONES DE EXPORTACIÓN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-neutral-800/60">
        <button
          type="button"
          onClick={copyToClipboard}
          className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{copied ? '✓ Copiado al portapapeles' : '📋 Copiar para IA'}</span>
        </button>

        <button
          type="button"
          onClick={() => downloadFile('txt')}
          className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>📥 Descargar Formato IA (.txt)</span>
        </button>

        <button
          type="button"
          onClick={() => downloadFile('json')}
          className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>⚙️ Descargar JSON completo</span>
        </button>
      </div>

      {/* LISTADO DE EDICIONES */}
      {isOpen && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-neutral-800/60 max-h-96 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-6 text-center text-xs text-neutral-500">
              Cargando historial de cambios...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-6 text-center text-xs text-neutral-500">
              No hay actividades registradas en la familia todavía.
            </div>
          ) : (
            logs.map((log) => {
              const badge = getEntityBadge(log.entity)
              const editDateObj = new Date(log.editedAt)
              const formattedDate = editDateObj.toLocaleDateString('es-CL', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })
              const formattedTime = editDateObj.toLocaleTimeString('es-CL', {
                hour: '2-digit',
                minute: '2-digit',
              })

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-[#131313] border border-neutral-800/70 flex flex-col gap-1.5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded">
                        {getActionLabel(log.action)}
                      </span>
                      <span className="text-xs font-semibold text-neutral-300">
                        👤 {log.actor}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <span>🕒 Editado:</span>
                      <span className="text-white font-bold capitalize">{formattedDate}</span>
                      <span>a las</span>
                      <span className="text-white font-bold">{formattedTime}</span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-200 m-0 font-medium leading-snug">
                    {log.title}
                  </p>

                  {log.scheduledAt && (
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[#F76911] font-semibold bg-[#F76911]/10 border border-[#F76911]/20 px-2.5 py-1 rounded-xl w-fit">
                      <span>🗓️ Programado:</span>
                      <span className="text-neutral-200 font-normal">{log.scheduledAt}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
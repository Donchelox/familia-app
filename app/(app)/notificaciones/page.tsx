import Link from 'next/link'
import { getContext } from '@/lib/family'
import { todayStr, nowHHMM } from '@/lib/dates'

export default async function NotificacionesPage() {
  const { supabase, familyId } = await getContext()
  const today = todayStr()
  const now = nowHHMM()

  // 1. Obtener medicamentos y sus registros de toma
  const [medsRes, logsRes, hwRes] = await Promise.all([
    supabase.from('medications').select('id, name, person, times').eq('family_id', familyId),
    supabase.from('dose_logs').select('medication_id, time').eq('family_id', familyId).eq('day', today),
    supabase.from('school_homework').select('id, title, due_date, done').eq('family_id', familyId).eq('done', false),
  ])

  const taken = new Set((logsRes.data ?? []).map((l) => `${l.medication_id}|${l.time}`))

  // Construir historial de notificaciones que ya debieron sonar hoy
  type NotificationLog = {
    id: string
    title: string
    message: string
    time: string
    category: 'Medicina' | 'Colegio'
    isPast: boolean
    isDone: boolean
  }

  const notifications: NotificationLog[] = []

  // Alertas de medicamentos para hoy
  ;(medsRes.data ?? []).forEach((m) => {
    (m.times || []).forEach((t: string) => {
      const isDone = taken.has(`${m.id}|${t}`)
      const isPast = t <= now

      notifications.push({
        id: `med-${m.id}-${t}`,
        title: `Recordatorio de Medicina: ${m.name}`,
        message: `Dosis de las ${t} programada para ${m.person}. ${isDone ? 'Tomada ✓' : isPast ? 'Hora cumplida (notificado)' : 'Programado para más tarde'}`,
        time: t,
        category: 'Medicina',
        isPast,
        isDone,
      })
    })
  })

  // Tareas de colegio para hoy o atrasadas
  ;(hwRes.data ?? []).forEach((hw) => {
    if (hw.due_date && hw.due_date <= today) {
      notifications.push({
        id: `hw-${hw.id}`,
        title: `Tarea escolar pendiente: ${hw.title}`,
        message: `Fecha límite: ${hw.due_date}`,
        time: 'Hoy',
        category: 'Colegio',
        isPast: true,
        isDone: false,
      })
    }
  })

  // Ordenar: primero las que ya pasaron / notificadas
  notifications.sort((a, b) => (b.isPast ? 1 : 0) - (a.isPast ? 1 : 0))

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center gap-4">
        <Link
          href="/"
          aria-label="Volver al inicio"
          className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-neutral-800 flex items-center justify-center text-white active:scale-95 transition-transform no-underline"
        >
          <svg className="w-5 h-5 stroke-white stroke-2 fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">Notificaciones</h1>
          <p className="text-xs text-neutral-400">Historial de recordatorios emitidos</p>
        </div>
      </header>

      {/* Lista de Notificaciones */}
      <div className="flex flex-col gap-3">
        {notifications.length === 0 ? (
          <div className="p-6 rounded-[20px] bg-[#1a1a1a] border border-neutral-800 text-center text-neutral-400 text-sm">
            No tienes notificaciones registradas para hoy.
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-[20px] border flex flex-col gap-1.5 transition-all ${
                item.isDone
                  ? 'bg-[#151515] border-neutral-800/40 opacity-60'
                  : item.isPast
                  ? 'bg-[#1e1a17] border-[#F76911]/40'
                  : 'bg-[#1a1a1a] border-neutral-800/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#fde9da] !text-[#F76911]">
                  {item.category}
                </span>
                <span className="text-xs text-neutral-400 font-mono">{item.time}</span>
              </div>
              <h3 className="text-sm font-bold text-white mt-0.5">{item.title}</h3>
              <p className="text-xs text-neutral-300">{item.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
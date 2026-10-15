import { SupabaseClient } from '@supabase/supabase-js'
import {
  todayStr,
  nowHHMM,
  weekday,
  isSchoolTestActive,
  isMedicationScheduledForDay,
} from '@/lib/dates'

export interface SummaryMedItem {
  id: string
  name: string
  dose?: string
  person?: string
  time: string
  isTaken: boolean
}

export interface SummaryTestItem {
  id: string
  subject: string
  topics?: string
  date: string
}

export interface SummaryHomeworkItem {
  id: string
  subject: string
  title: string
  dueDate: string
  done: boolean
}

export interface SummaryTodoItem {
  id: string
  title: string
  dueDate?: string | null
}

export interface MorningSummaryData {
  today: string
  formattedDate: string
  medsToday: SummaryMedItem[]
  testsToday: SummaryTestItem[]
  homeworkToday: SummaryHomeworkItem[]
  todosToday: SummaryTodoItem[]
  shoppingSuperCount: number
  shoppingFeriaCount: number
  totalItemsScheduled: number
}

/**
 * Consulta y estructura todo lo programado para una familia en la fecha actual
 */
export async function fetchMorningSummary(
  supabase: SupabaseClient,
  familyId: string,
  targetDate?: string
): Promise<MorningSummaryData> {
  const day = targetDate || todayStr()
  const currentWeekday = weekday(day) // 1 = lunes ... 7 = domingo
  const currentHM = nowHHMM()

  const [medsRes, doseLogsRes, testsRes, homeworkRes, todosRes, shoppingRes] =
    await Promise.all([
      // 1. Medicamentos de la familia
      supabase
        .from('medications')
        .select('id, name, dose, person, times, frequency, end_date')
        .eq('family_id', familyId),

      // 2. Registros de dosis tomadas hoy
      supabase
        .from('dose_logs')
        .select('medication_id, time')
        .eq('family_id', familyId)
        .eq('day', day),

      // 3. Pruebas escolares para hoy (filtradas por test_date y activas antes de las 20:00 hrs)
      supabase
        .from('school_tests')
        .select('id, subject, topic, test_date')
        .eq('family_id', familyId),

      // 4. Tareas escolares que vencen hoy o pendientes
      supabase
        .from('school_homework')
        .select('id, subject, title, due_date, done')
        .eq('family_id', familyId)
        .eq('due_date', day),

      // 5. Quehaceres / Tareas del hogar pendientes
      supabase
        .from('todos')
        .select('id, title, due_date, done')
        .eq('family_id', familyId)
        .or('done.eq.false,done.is.null'),

      // 6. Lista de compras pendientes (Super y Feria)
      supabase
        .from('shopping_items')
        .select('id, name, list, done')
        .eq('family_id', familyId)
        .or('done.eq.false,done.is.null'),
    ])

  // Procesar medicamentos de hoy: solo los programados estrictamente para este día
  const takenSet = new Set(
    (doseLogsRes.data ?? []).map(
      (l) => `${l.medication_id}|${String(l.time).slice(0, 5)}`
    )
  )

  const medsToday: SummaryMedItem[] = []
  for (const m of medsRes.data ?? []) {
    // Evalúa si corresponde tomar este medicamento hoy (frecuencia, días específicos, fecha de fin)
    if (!isMedicationScheduledForDay(m, day, currentWeekday)) {
      continue
    }

    const times: string[] = Array.isArray(m.times)
      ? m.times
      : typeof m.times === 'string'
      ? m.times.split(',').map((t: string) => t.trim())
      : []

    for (const t of times) {
      const cleanTime = t.slice(0, 5)
      if (!cleanTime) continue
      const isTaken = takenSet.has(`${m.id}|${cleanTime}`)
      medsToday.push({
        id: `${m.id}-${cleanTime}`,
        name: m.name,
        dose: m.dose || undefined,
        person: m.person || undefined,
        time: cleanTime,
        isTaken,
      })
    }
  }

  // Ordenar medicamentos cronológicamente
  medsToday.sort((a, b) => a.time.localeCompare(b.time))

  // Pruebas escolares (solo activas hoy según la regla de borrado a las 20:00 hrs)
  const testsToday: SummaryTestItem[] = (testsRes.data ?? [])
    .filter((t: any) => t.test_date === day && isSchoolTestActive(t.test_date, currentHM, day))
    .map((t: any) => ({
      id: t.id,
      subject: t.subject,
      topics: t.topic || undefined,
      date: t.test_date,
    }))

  // Tareas escolares del día
  const homeworkToday: SummaryHomeworkItem[] = (homeworkRes.data ?? []).map(
    (h) => ({
      id: h.id,
      subject: h.subject,
      title: h.title,
      dueDate: h.due_date,
      done: Boolean(h.done),
    })
  )

  // Tareas del hogar: solo pendientes para hoy o sin fecha futura
  const todosToday: SummaryTodoItem[] = (todosRes.data ?? [])
    .filter((t: any) => {
      if (!t.due_date) return true
      const dueDay = String(t.due_date).slice(0, 10)
      return dueDay <= day
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
    }))

  // Conteo de compras
  // Feria: aplica si hoy es día de feria (Jueves = 4 o Domingo = 7 por defecto) o hay pendientes
  const isFeriaDay = currentWeekday === 4 || currentWeekday === 7
  let shoppingSuperCount = 0
  let shoppingFeriaCount = 0
  for (const item of shoppingRes.data ?? []) {
    if (item.list === 'feria') {
      if (isFeriaDay) {
        shoppingFeriaCount++
      }
    } else {
      shoppingSuperCount++
    }
  }

  // Formato legible de fecha en español
  const dateObj = new Date(`${day}T12:00:00Z`)
  const formattedDate = dateObj.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

  const totalItemsScheduled =
    medsToday.length +
    testsToday.length +
    homeworkToday.length +
    todosToday.length +
    (shoppingSuperCount + shoppingFeriaCount > 0 ? 1 : 0)

  return {
    today: day,
    formattedDate: capitalizedDate,
    medsToday,
    testsToday,
    homeworkToday,
    todosToday,
    shoppingSuperCount,
    shoppingFeriaCount,
    totalItemsScheduled,
  }
}

/**
 * Genera el título y cuerpo amigable para la notificación push matutina
 */
export function buildMorningSummaryPushPayload(summary: MorningSummaryData) {
  const parts: string[] = []

  if (summary.medsToday.length > 0) {
    const nextMed = summary.medsToday[0]
    parts.push(
      `${summary.medsToday.length} medicin${
        summary.medsToday.length === 1 ? 'a' : 'as'
      } (${nextMed.name} ${nextMed.time})`
    )
  }

  if (summary.testsToday.length > 0) {
    parts.push(
      `${summary.testsToday.length} prueba${
        summary.testsToday.length === 1 ? '' : 's'
      } (${summary.testsToday[0].subject})`
    )
  }

  if (summary.homeworkToday.length > 0) {
    parts.push(
      `${summary.homeworkToday.length} tarea${
        summary.homeworkToday.length === 1 ? '' : 's'
      } escolar${summary.homeworkToday.length === 1 ? '' : 'es'}`
    )
  }

  if (summary.todosToday.length > 0) {
    parts.push(
      `${summary.todosToday.length} quehacer${
        summary.todosToday.length === 1 ? '' : 'es'
      }`
    )
  }

  const shoppingTotal =
    summary.shoppingSuperCount + summary.shoppingFeriaCount
  if (shoppingTotal > 0) {
    parts.push(`${shoppingTotal} compras`)
  }

  let body = ''
  if (parts.length === 0) {
    body = '¡Todo despejado! No tienes pendientes programados para hoy.'
  } else {
    body = `Este día tienes: ${parts.join(', ')}. Toca para ver el detalle.`
  }

  return {
    title: '🌅 Resumen de Hoy · Casa',
    body,
    url: '/resumen',
    tag: `morning-summary-${summary.today}`,
  }
}

/**
 * Despacha las notificaciones push matutinas a las familias cuyo horario coincida
 */
export async function dispatchMorningSummary(
  supabase: SupabaseClient,
  currentHHMM: string,
  today: string,
  force: boolean = false
): Promise<{ targeted: number; sent: number }> {
  // 1. Obtener familias
  const { data: families } = await supabase
    .from('families')
    .select('id, reminder_email')

  if (!families || families.length === 0) {
    return { targeted: 0, sent: 0 }
  }

  // 2. Preferencias de horario por familia (admin)
  const famIds = families.map((f) => f.id)
  const { data: adminMembers } = await supabase
    .from('members')
    .select('family_id, user_id')
    .eq('role', 'admin')
    .in('family_id', famIds)

  const familyTimes = new Map<string, { enabled: boolean; time: string }>()
  for (const f of families) {
    familyTimes.set(f.id, {
      enabled: f.reminder_email ?? true,
      time: '07:00',
    })
  }

  if (adminMembers && adminMembers.length > 0) {
    await Promise.all(
      adminMembers.map(async (m) => {
        try {
          const { data: u } = await supabase.auth.admin.getUserById(m.user_id)
          const meta = u.user?.user_metadata
          const isEnabled = meta?.morning_summary_enabled !== false
          const configuredTime = meta?.morning_summary_time || '07:00'
          familyTimes.set(m.family_id, {
            enabled: isEnabled,
            time: configuredTime,
          })
        } catch {}
      })
    )
  }

  // 3. Filtrar familias cuyo horario coincida
  const dueFamilies: string[] = []
  for (const [famId, conf] of familyTimes.entries()) {
    if (!conf.enabled) continue
    if (force || conf.time === currentHHMM) {
      dueFamilies.push(famId)
    }
  }

  if (dueFamilies.length === 0) {
    return { targeted: 0, sent: 0 }
  }

  // 4. Deduplicación por fecha en activity_log
  const dedupTag = `morning_summary_${today}`
  const { data: existingLogs } = await supabase
    .from('activity_log')
    .select('family_id')
    .eq('module', 'Resumen Matutino')
    .eq('action', 'notificado')
    .eq('item', dedupTag)
    .in('family_id', dueFamilies)

  const alreadySent = new Set((existingLogs ?? []).map((l) => l.family_id))
  const targetFamilies = force
    ? dueFamilies
    : dueFamilies.filter((id) => !alreadySent.has(id))

  if (targetFamilies.length === 0) {
    return { targeted: dueFamilies.length, sent: 0 }
  }

  // 5. Suscripciones push
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', targetFamilies)

  let sent = 0
  const jobs: Promise<void>[] = []

  // Dynamic import of web-push
  const webpush = await import('web-push')
  const {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = process.env

  if (NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
    webpush.default.setVapidDetails(
      VAPID_SUBJECT,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    )
  }

  for (const famId of targetFamilies) {
    const summary = await fetchMorningSummary(supabase, famId, today)
    const payload = JSON.stringify(buildMorningSummaryPushPayload(summary))
    const famSubs = (subs ?? []).filter((s) => s.family_id === famId)

    for (const sub of famSubs) {
      jobs.push(
        webpush.default
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          .then(() => {
            sent++
          })
          .catch(async (err: any) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          })
      )
    }

    jobs.push(
      (async () => {
        await supabase.from('activity_log').insert({
          family_id: famId,
          user_name: 'Sistema',
          module: 'Resumen Matutino',
          action: 'notificado',
          item: dedupTag,
        })
      })()
    )
  }

  await Promise.all(jobs)
  return { targeted: targetFamilies.length, sent }
}

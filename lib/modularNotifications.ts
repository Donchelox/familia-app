import { SupabaseClient } from '@supabase/supabase-js'
import { nowHHMM, todayStr, weekday, isSchoolTestActive, isTimeDueToday } from '@/lib/dates'

const WEEKDAY_NAMES = [
  '',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
]

export interface FamilyNotificationPrefs {
  familyId: string
  // Colegio
  schoolEnabled: boolean
  schoolTime: string
  // Feria
  feriaEnabled: boolean
  feriaDays: string[]
  feriaTime: string
  // Super
  superEnabled: boolean
  superTime: string
}

async function runPushWithConcurrency(tasks: (() => Promise<void>)[], limit = 5) {
  if (!tasks.length) return
  let taskIdx = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (taskIdx < tasks.length) {
      const fn = tasks[taskIdx++]
      await fn()
    }
  })
  await Promise.all(workers)
}

/**
 * Obtiene las preferencias de notificaciones para todas las familias desde los metadatos de administradores
 */
export async function getFamiliesNotificationPrefs(
  supabase: SupabaseClient
): Promise<Map<string, FamilyNotificationPrefs>> {
  const { data: families } = await supabase
    .from('families')
    .select('id, reminder_push, reminder_email, school_reminders_enabled, school_reminder_time, feria_reminders_enabled, feria_days, feria_time, super_reminders_enabled, super_time')

  const prefsMap = new Map<string, FamilyNotificationPrefs>()
  if (!families || families.length === 0) return prefsMap

  for (const f of families) {
    prefsMap.set(f.id, {
      familyId: f.id,
      schoolEnabled: (f as any).school_reminders_enabled !== false,
      schoolTime: (f as any).school_reminder_time || '07:30',
      feriaEnabled: (f as any).feria_reminders_enabled !== false,
      feriaDays: Array.isArray((f as any).feria_days) && (f as any).feria_days.length > 0
        ? (f as any).feria_days
        : ['Jueves', 'Domingo'],
      feriaTime: (f as any).feria_time || '07:00',
      superEnabled: (f as any).super_reminders_enabled !== false,
      superTime: (f as any).super_time || '18:00',
    })
  }

  return prefsMap
}

/**
 * Regla de negocio crítica: Borra del listado y de la BD las pruebas escolares
 * el día que tiene la prueba a las 8:00 PM (20:00 hrs) y en los días posteriores.
 */
export async function cleanExpiredSchoolTests(
  supabase: SupabaseClient,
  currentDay: string,
  currentHM: string
): Promise<number> {
  try {
    // 1. Pruebas de días anteriores a hoy
    const { data: pastTests } = await supabase
      .from('school_tests')
      .select('id, test_date')
      .lt('test_date', currentDay)

    const idsToDelete = (pastTests ?? []).map((t) => t.id)

    // 2. Pruebas de hoy si la hora actual es >= 20:00 hrs (8:00 PM)
    if (currentHM >= '20:00') {
      const { data: todayTests } = await supabase
        .from('school_tests')
        .select('id, test_date')
        .eq('test_date', currentDay)

      if (todayTests && todayTests.length > 0) {
        idsToDelete.push(...todayTests.map((t) => t.id))
      }
    }

    if (idsToDelete.length > 0) {
      await supabase.from('school_tests').delete().in('id', idsToDelete)
      return idsToDelete.length
    }
  } catch (err) {
    console.error('Error al limpiar pruebas escolares vencidas:', err)
  }
  return 0
}

/**
 * Despacha notificaciones push de Colegio (Pruebas y Tareas del día)
 */
export async function dispatchSchoolReminders(
  supabase: SupabaseClient,
  prefsMap: Map<string, FamilyNotificationPrefs>,
  currentHM: string,
  currentDay: string,
  webpush: any
): Promise<number> {
  const eligibleFamilies = Array.from(prefsMap.values()).filter(
    (p) => p.schoolEnabled && isTimeDueToday(p.schoolTime, currentHM, 120)
  )
  if (eligibleFamilies.length === 0) return 0

  const famIds = eligibleFamilies.map((f) => f.familyId)
  const dedupTag = `school_reminders_${currentDay}`

  const { data: existingLogs } = await supabase
    .from('activity_log')
    .select('family_id')
    .eq('module', 'Colegio')
    .eq('action', 'notificado')
    .eq('item', dedupTag)
    .in('family_id', famIds)

  const alreadySent = new Set((existingLogs ?? []).map((l) => l.family_id))
  const targetFamilies = eligibleFamilies.filter((f) => !alreadySent.has(f.familyId))
  if (targetFamilies.length === 0) return 0

  const targetIds = targetFamilies.map((f) => f.familyId)

  // Consultar pruebas y tareas de hoy
  const [testsRes, hwRes, subsRes] = await Promise.all([
    supabase
      .from('school_tests')
      .select('id, family_id, subject, topic, test_date')
      .eq('test_date', currentDay)
      .in('family_id', targetIds),
    supabase
      .from('school_homework')
      .select('id, family_id, subject, title, due_date, done')
      .eq('due_date', currentDay)
      .or('done.eq.false,done.is.null')
      .in('family_id', targetIds),
    supabase
      .from('push_subscriptions')
      .select('id, family_id, endpoint, p256dh, auth')
      .in('family_id', targetIds),
  ])

  let sent = 0
  const pushTasks: (() => Promise<void>)[] = []

  for (const fam of targetFamilies) {
    try {
      const famTests = (testsRes.data ?? []).filter(
        (t) => t.family_id === fam.familyId && isSchoolTestActive(t.test_date, currentHM, currentDay)
      )
      const famHw = (hwRes.data ?? []).filter((h) => h.family_id === fam.familyId)

      // Si no hay nada de colegio para hoy, no molestar
      if (famTests.length === 0 && famHw.length === 0) continue

      let title = '📚 Colegio · Recordatorio de Hoy'
      let body = ''

      if (famTests.length > 0 && famHw.length > 0) {
        title = `📝 Prueba Hoy: ${famTests[0].subject}`
        body = `Hoy tienes prueba de ${famTests[0].subject} y ${famHw.length} tarea escolar pendiente. ¡Mucho éxito!`
      } else if (famTests.length > 0) {
        title = `📝 Prueba Hoy: ${famTests[0].subject}`
        body = `Hoy es día de prueba de ${famTests[0].subject}${famTests[0].topic ? ` (${famTests[0].topic})` : ''}. Recuerda revisar tus contenidos.`
      } else {
        title = `📖 Tarea Escolar para Hoy`
        body = `Tienes ${famHw.length} tarea${famHw.length === 1 ? '' : 's'} por entregar hoy (${famHw[0].subject}).`
      }

      const payload = JSON.stringify({
        title,
        body,
        url: '/colegio',
        tag: `school-reminder-${fam.familyId}-${currentDay}`,
      })

      const famSubs = (subsRes.data ?? []).filter((s) => s.family_id === fam.familyId)
      for (const sub of famSubs) {
        pushTasks.push(async () => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
            sent++
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          }
        })
      }

      pushTasks.push(async () => {
        try {
          await supabase.from('activity_log').insert({
            family_id: fam.familyId,
            user_name: 'Sistema',
            module: 'Colegio',
            action: 'notificado',
            item: dedupTag,
          })
        } catch {}
      })
    } catch (famErr) {
      console.error(`Error procesando recordatorio escolar para familia ${fam.familyId}:`, famErr)
    }
  }

  await runPushWithConcurrency(pushTasks, 5)
  return sent
}

/**
 * Despacha notificaciones push de Feria Libre (Jueves y Domingo por defecto a las 07:00 AM)
 */
export async function dispatchFeriaReminders(
  supabase: SupabaseClient,
  prefsMap: Map<string, FamilyNotificationPrefs>,
  currentHM: string,
  currentDay: string,
  currentWeekdayName: string,
  webpush: any
): Promise<number> {
  const eligibleFamilies = Array.from(prefsMap.values()).filter(
    (p) =>
      p.feriaEnabled &&
      p.feriaDays.includes(currentWeekdayName) &&
      isTimeDueToday(p.feriaTime, currentHM, 120)
  )
  if (eligibleFamilies.length === 0) return 0

  const famIds = eligibleFamilies.map((f) => f.familyId)
  const dedupTag = `feria_reminders_${currentDay}`

  const { data: existingLogs } = await supabase
    .from('activity_log')
    .select('family_id')
    .eq('module', 'Feria')
    .eq('action', 'notificado')
    .eq('item', dedupTag)
    .in('family_id', famIds)

  const alreadySent = new Set((existingLogs ?? []).map((l) => l.family_id))
  const targetFamilies = eligibleFamilies.filter((f) => !alreadySent.has(f.familyId))
  if (targetFamilies.length === 0) return 0

  const targetIds = targetFamilies.map((f) => f.familyId)

  // Consultar productos pendientes de feria
  const [itemsRes, subsRes] = await Promise.all([
    supabase
      .from('shopping_items')
      .select('id, family_id, name, done, list')
      .eq('list', 'feria')
      .or('done.eq.false,done.is.null')
      .in('family_id', targetIds),
    supabase
      .from('push_subscriptions')
      .select('id, family_id, endpoint, p256dh, auth')
      .in('family_id', targetIds),
  ])

  let sent = 0
  const pushTasks: (() => Promise<void>)[] = []

  for (const fam of targetFamilies) {
    try {
      const pendingItems = (itemsRes.data ?? []).filter((i) => i.family_id === fam.familyId)
      const count = pendingItems.length

      const title = '🥬 Recordatorio de Feria Libre'
      const body =
        count > 0
          ? `Hoy es día de feria (${currentWeekdayName}). Tienes ${count} producto${count === 1 ? '' : 's'} pendientes por comprar.`
          : `Hoy es día de feria (${currentWeekdayName}). Revisa qué verduras o frutas faltan en casa.`

      const payload = JSON.stringify({
        title,
        body,
        url: '/feria',
        tag: `feria-reminder-${fam.familyId}-${currentDay}`,
      })

      const famSubs = (subsRes.data ?? []).filter((s) => s.family_id === fam.familyId)
      for (const sub of famSubs) {
        pushTasks.push(async () => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
            sent++
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          }
        })
      }

      pushTasks.push(async () => {
        try {
          await supabase.from('activity_log').insert({
            family_id: fam.familyId,
            user_name: 'Sistema',
            module: 'Feria',
            action: 'notificado',
            item: dedupTag,
          })
        } catch {}
      })
    } catch (famErr) {
      console.error(`Error procesando recordatorio de feria para familia ${fam.familyId}:`, famErr)
    }
  }

  await runPushWithConcurrency(pushTasks, 5)
  return sent
}

/**
 * Despacha notificaciones push de Supermercado
 */
export async function dispatchSuperReminders(
  supabase: SupabaseClient,
  prefsMap: Map<string, FamilyNotificationPrefs>,
  currentHM: string,
  currentDay: string,
  webpush: any
): Promise<number> {
  const eligibleFamilies = Array.from(prefsMap.values()).filter(
    (p) => p.superEnabled && isTimeDueToday(p.superTime, currentHM, 120)
  )
  if (eligibleFamilies.length === 0) return 0

  const famIds = eligibleFamilies.map((f) => f.familyId)
  const dedupTag = `super_reminders_${currentDay}`

  const { data: existingLogs } = await supabase
    .from('activity_log')
    .select('family_id')
    .eq('module', 'Supermercado')
    .eq('action', 'notificado')
    .eq('item', dedupTag)
    .in('family_id', famIds)

  const alreadySent = new Set((existingLogs ?? []).map((l) => l.family_id))
  const targetFamilies = eligibleFamilies.filter((f) => !alreadySent.has(f.familyId))
  if (targetFamilies.length === 0) return 0

  const targetIds = targetFamilies.map((f) => f.familyId)

  // Consultar productos pendientes de supermercado
  const [itemsRes, subsRes] = await Promise.all([
    supabase
      .from('shopping_items')
      .select('id, family_id, name, done, list')
      .neq('list', 'feria')
      .or('done.eq.false,done.is.null')
      .in('family_id', targetIds),
    supabase
      .from('push_subscriptions')
      .select('id, family_id, endpoint, p256dh, auth')
      .in('family_id', targetIds),
  ])

  let sent = 0
  const pushTasks: (() => Promise<void>)[] = []

  for (const fam of targetFamilies) {
    try {
      const pendingItems = (itemsRes.data ?? []).filter((i) => i.family_id === fam.familyId)
      const count = pendingItems.length
      if (count === 0) continue // Si no hay nada pendiente en supermercado, no enviar aviso

      const title = '🛒 Compras de Supermercado'
      const body = `Tienes ${count} producto${count === 1 ? '' : 's'} pendientes en tu lista de supermercado.`

      const payload = JSON.stringify({
        title,
        body,
        url: '/super',
        tag: `super-reminder-${fam.familyId}-${currentDay}`,
      })

      const famSubs = (subsRes.data ?? []).filter((s) => s.family_id === fam.familyId)
      for (const sub of famSubs) {
        pushTasks.push(async () => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            )
            sent++
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
          }
        })
      }

      pushTasks.push(async () => {
        try {
          await supabase.from('activity_log').insert({
            family_id: fam.familyId,
            user_name: 'Sistema',
            module: 'Supermercado',
            action: 'notificado',
            item: dedupTag,
          })
        } catch {}
      })
    } catch (famErr) {
      console.error(`Error procesando recordatorio de supermercado para familia ${fam.familyId}:`, famErr)
    }
  }

  await runPushWithConcurrency(pushTasks, 5)
  return sent
}

/**
 * Función central que ejecuta la limpieza de pruebas a las 8:00 PM y despacha los avisos modulares
 */
export async function runModularNotificationsCron(
  supabase: SupabaseClient,
  currentHM?: string,
  currentDay?: string
) {
  const hm = currentHM || nowHHMM()
  const day = currentDay || todayStr()
  const currentWkDay = weekday()
  const currentWeekdayName = WEEKDAY_NAMES[currentWkDay] || 'Lunes'

  // 1. Limpieza estricta de pruebas del colegio (se borran a las 20:00 hrs del día de la prueba y días anteriores)
  const cleanedCount = await cleanExpiredSchoolTests(supabase, day, hm)

  // 2. Cargar preferencias
  const prefsMap = await getFamiliesNotificationPrefs(supabase)

  // 3. Inicializar webpush
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

  // 4. Despachar avisos concurrentes
  const [schoolSent, feriaSent, superSent] = await Promise.all([
    dispatchSchoolReminders(supabase, prefsMap, hm, day, webpush.default),
    dispatchFeriaReminders(supabase, prefsMap, hm, day, currentWeekdayName, webpush.default),
    dispatchSuperReminders(supabase, prefsMap, hm, day, webpush.default),
  ])

  return {
    hm,
    day,
    cleanedCount,
    schoolSent,
    feriaSent,
    superSent,
  }
}

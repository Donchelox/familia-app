import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { nowHHMM, todayStr, weekday } from '@/lib/dates'
import { planReminders, type MedRow, type ReminderRow } from '@/lib/medReminders'
import { dispatchMorningSummary } from '@/lib/morningSummary'
import { runModularNotificationsCron } from '@/lib/modularNotifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Debe ejecutarse CADA MINUTO (ver lib/medReminders.ts para la regla de repetición).
// Cada aviso "reclama" su intervalo en la tabla dose_reminders antes de enviarse, así que si el
// cron corre dos veces seguidas o se atrasa, no se duplican ni se acumulan avisos.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const got = Buffer.from(req.headers.get('authorization') ?? '')
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const {
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = process.env

  if (
    !NEXT_PUBLIC_SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY ||
    !VAPID_SUBJECT
  ) {
    return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
  }

  // 3.2 createClient con persistSession: false, autoRefreshToken: false
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const hm = nowHHMM() // hora de Chile, HH:MM
  const day = todayStr()
  const nowMs = Date.now()

  // Resumen Matutino y Notificaciones Modulares
  try {
    await dispatchMorningSummary(supabase, hm, day)
  } catch (mErr: any) {
    console.error('cron morning-summary error:', mErr?.message || 'Error desconocido')
  }

  try {
    await runModularNotificationsCron(supabase, hm, day)
  } catch (modErr: any) {
    console.error('cron modular-notifications error:', modErr?.message || 'Error desconocido')
  }

  // 1. Medicamentos (se filtran por hora, frecuencia y fecha de término en planReminders)
  const { data: medsData, error: medsErr } = await supabase
    .from('medications')
    .select('id, name, dose, person, family_id, times, frequency, end_date')
  if (medsErr) {
    console.error('cron meds query error:', medsErr.message)
    return NextResponse.json({ error: 'Error consultando medicamentos' }, { status: 500 })
  }
  const meds = (medsData ?? []) as MedRow[]
  if (!meds.length) return NextResponse.json({ ok: true, hm, due: 0, sent: 0 })
  const medIds = meds.map((m) => m.id)

  // 2. Consulta de familias e intervalos desde la tabla families (3.3)
  const famIds = [...new Set(meds.map((m) => m.family_id))]
  const { data: fams, error: famsErr } = await supabase
    .from('families')
    .select('id, reminder_push, med_reminder_interval, reminder_push_detail')
    .in('id', famIds)
  if (famsErr) {
    console.error('cron families query error:', famsErr.message)
    return NextResponse.json({ error: 'Error consultando familias' }, { status: 500 })
  }

  const pushFamilies = new Set((fams ?? []).filter((f) => f.reminder_push).map((f) => f.id as string))
  const familyIntervals = new Map<string, number>()
  const familyDetailMap = new Map<string, boolean>()

  for (const f of fams ?? []) {
    const interval = Number(f.med_reminder_interval)
    if ([5, 10, 15, 30].includes(interval)) {
      familyIntervals.set(f.id, interval)
    }
    familyDetailMap.set(f.id, Boolean(f.reminder_push_detail))
  }

  // 3.4 Salir temprano si ninguna familia tiene reminder_push antes de consultar dose_logs y dose_reminders
  if (pushFamilies.size === 0) {
    return NextResponse.json({ ok: true, hm, due: 0, sent: 0, note: 'Sin familias con recordatorios push activos' })
  }

  // 3. Dosis ya marcadas como tomadas hoy
  const { data: logs, error: logsErr } = await supabase
    .from('dose_logs')
    .select('medication_id, time')
    .eq('day', day)
    .in('medication_id', medIds)
  if (logsErr) {
    console.error('cron dose_logs error:', logsErr.message)
  }
  const taken = new Set((logs ?? []).map((l) => `${l.medication_id}|${String(l.time).slice(0, 5)}`))

  // 4. Avisos ya enviados hoy (estado de la repetición)
  const { data: recData, error: recErr } = await supabase
    .from('dose_reminders')
    .select('medication_id, time, first_sent_at, last_slot')
    .eq('day', day)
    .in('medication_id', medIds)
  if (recErr) {
    console.error('cron dose_reminders error:', recErr.message)
    return NextResponse.json(
      { error: 'Error leyendo dose_reminders' },
      { status: 500 }
    )
  }
  const reminders = new Map<string, ReminderRow>(
    ((recData ?? []) as ReminderRow[]).map((r) => [`${r.medication_id}|${r.time}`, r])
  )

  // 3.4 Limpieza de dose_reminders solo una vez al día (a las 03:00) en vez de cada minuto
  if (hm === '03:00') {
    const cutoff = new Date(day + 'T12:00:00Z')
    cutoff.setUTCDate(cutoff.getUTCDate() - 2)
    const { error: cleanErr } = await supabase
      .from('dose_reminders')
      .delete()
      .lt('day', cutoff.toISOString().slice(0, 10))
    if (cleanErr) {
      console.error('cron cleanup dose_reminders error:', cleanErr.message)
    }
  }

  // 5. Qué avisos tocan ahora
  const plan = planReminders({
    meds,
    day,
    isoWeekday: weekday(),
    nowMs,
    nowHM: hm,
    taken,
    reminders,
    pushFamilies,
    familyIntervals,
  })
  if (!plan.length) return NextResponse.json({ ok: true, hm, due: 0, sent: 0 })

  // 6. Reclamar cada aviso: solo la ejecución que lo reclama primero lo envía
  const claimed: typeof plan = []
  for (const p of plan) {
    if (p.kind === 'first') {
      const { data, error } = await supabase
        .from('dose_reminders')
        .upsert(
          { medication_id: p.med.id, family_id: p.med.family_id, day, time: p.time, first_sent_at: new Date(nowMs).toISOString(), last_slot: 0 },
          { onConflict: 'medication_id,day,time', ignoreDuplicates: true }
        )
        .select('medication_id')
      if (error) { console.error('cron claim first error:', error.message); continue }
      if (!data?.length) continue
    } else {
      const { data, error } = await supabase
        .from('dose_reminders')
        .update({ last_slot: p.slot })
        .eq('medication_id', p.med.id)
        .eq('day', day)
        .eq('time', p.time)
        .lt('last_slot', p.slot)
        .select('medication_id')
      if (error) { console.error('cron claim repeat error:', error.message); continue }
      if (!data?.length) continue
    }
    claimed.push(p)
  }
  if (!claimed.length) return NextResponse.json({ ok: true, hm, due: plan.length, sent: 0 })

  // 7. Suscripciones de esas familias
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', [...new Set(claimed.map((p) => p.med.family_id))])
  if (subsErr) {
    console.error('cron push_subscriptions query error:', subsErr.message)
  }

  let sent = 0
  const jobs: Promise<void>[] = []
  for (const p of claimed) {
    const { med } = p
    const allowDetail = familyDetailMap.get(med.family_id) ?? false

    // 3.7 Privacidad: no mostrar nombre ni dosis en pantalla bloqueada por defecto
    let title: string
    let body: string
    if (allowDetail) {
      const who = `${med.person ? med.person + ' · ' : ''}${med.dose || 'Dosis habitual'}`
      title = p.kind === 'repeat' ? `⏰ ${med.name} · sin confirmar` : `💊 ${med.name}`
      body = p.kind === 'repeat'
        ? `${who}. Pasaron ${p.minutesLate} min y aún no lo marcas como tomado.`
        : `${who}. Es momento de tomarlo.`
    } else {
      title = p.kind === 'repeat' ? '⏰ Recordatorio de medicamento' : '💊 Hora de un medicamento'
      body = p.kind === 'repeat'
        ? `Tienes una dosis pendiente por confirmar (${p.minutesLate} min). Toca para ver el detalle.`
        : 'Es momento de tomar un medicamento programado. Toca para ver el detalle.'
    }

    const payload = JSON.stringify({
      title,
      body,
      url: '/meds',
      // Mismo tag en toda la serie: en la bandeja queda un solo aviso por dosis que se vuelve a sonar
      tag: `med-${med.id}-${day}-${p.time}`,
    })

    // 3.1 webpush.sendNotification con { TTL: 1200, urgency: 'high', timeout: 10000 }
    const sendOptions = { TTL: 1200, urgency: 'high' as const, timeout: 10000 }

    for (const sub of (subs ?? []).filter((s) => s.family_id === med.family_id)) {
      jobs.push(
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            sendOptions
          )
          .then(() => {
            sent++
          })
          .catch(async (err: any) => {
            // 3.6 Eliminar si 404, 410 o si no tiene statusCode (clave criptográfica inválida)
            const status = err?.statusCode
            if (status === 404 || status === 410 || !status) {
              console.error(`Suscripción push inválida (status: ${status ?? 'sin status'}), eliminando suscripción ID:`, sub.id)
              try {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id)
              } catch (delErr: any) {
                console.error('Error eliminando suscripción push caducada:', delErr?.message)
              }
            } else {
              console.error('Error enviando push status:', status)
            }
          })
      )
    }
  }
  await Promise.all(jobs)

  // 3.8 Ping opcional a HEALTHCHECK_URL al terminar con éxito
  const healthcheckUrl = process.env.HEALTHCHECK_URL
  if (healthcheckUrl) {
    try {
      await fetch(healthcheckUrl, { method: 'GET', signal: AbortSignal.timeout(5000) }).catch((hcErr) => {
        console.error('Healthcheck ping error:', hcErr?.message)
      })
    } catch {}
  }

  return NextResponse.json({ ok: true, hm, due: plan.length, sent })
}

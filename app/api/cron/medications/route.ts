import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { nowHHMM, todayStr, weekday } from '@/lib/dates'
import { planReminders, type MedRow, type ReminderRow } from '@/lib/medReminders'

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

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return NextResponse.json({ error: 'Faltan variables de entorno' }, { status: 500 })
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const hm = nowHHMM() // hora de Chile, HH:MM
  const day = todayStr()
  const nowMs = Date.now()

  // 1. Medicamentos (se filtran por hora, frecuencia y fecha de término en planReminders)
  const { data: medsData, error: medsErr } = await supabase
    .from('medications')
    .select('id, name, dose, person, family_id, times, frequency, end_date')
  if (medsErr) {
    console.error('cron meds:', medsErr)
    return NextResponse.json({ error: 'Error consultando medicamentos' }, { status: 500 })
  }
  const meds = (medsData ?? []) as MedRow[]
  if (!meds.length) return NextResponse.json({ ok: true, hm, due: 0, sent: 0 })
  const medIds = meds.map((m) => m.id)

  // 2. Solo familias con push activado
  const famIds = [...new Set(meds.map((m) => m.family_id))]
  const { data: fams } = await supabase.from('families').select('id, reminder_push').in('id', famIds)
  const pushFamilies = new Set((fams ?? []).filter((f) => f.reminder_push).map((f) => f.id as string))

  // Intervalo configurado por familia (5, 10, 15 o 30 minutos; por defecto 5)
  const familyIntervals = new Map<string, number>()
  const { data: adminMembers } = await supabase
    .from('members')
    .select('family_id, user_id')
    .eq('role', 'admin')
    .in('family_id', famIds)

  if (adminMembers && adminMembers.length > 0) {
    await Promise.all(
      adminMembers.map(async (m) => {
        try {
          const { data: u } = await supabase.auth.admin.getUserById(m.user_id)
          const interval = Number(u.user?.user_metadata?.med_reminder_interval)
          if ([5, 10, 15, 30].includes(interval)) {
            familyIntervals.set(m.family_id, interval)
          }
        } catch {}
      })
    )
  }

  // 3. Dosis ya marcadas como tomadas hoy
  const { data: logs } = await supabase.from('dose_logs').select('medication_id, time').eq('day', day).in('medication_id', medIds)
  const taken = new Set((logs ?? []).map((l) => `${l.medication_id}|${String(l.time).slice(0, 5)}`))

  // 4. Avisos ya enviados hoy (estado de la repetición)
  const { data: recData, error: recErr } = await supabase
    .from('dose_reminders')
    .select('medication_id, time, first_sent_at, last_slot')
    .eq('day', day)
    .in('medication_id', medIds)
  if (recErr) {
    console.error('cron dose_reminders:', recErr)
    return NextResponse.json(
      { error: 'Error leyendo dose_reminders. ¿Ejecutaste supabase/dose-reminders.sql?' },
      { status: 500 }
    )
  }
  const reminders = new Map<string, ReminderRow>(
    ((recData ?? []) as ReminderRow[]).map((r) => [`${r.medication_id}|${r.time}`, r])
  )

  // Limpieza: se conservan solo los últimos días
  const cutoff = new Date(day + 'T12:00:00Z')
  cutoff.setUTCDate(cutoff.getUTCDate() - 2)
  await supabase.from('dose_reminders').delete().lt('day', cutoff.toISOString().slice(0, 10))

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
      if (error) { console.error('cron claim first:', error); continue }
      if (!data?.length) continue // otra ejecución ya lo tomó
    } else {
      const { data, error } = await supabase
        .from('dose_reminders')
        .update({ last_slot: p.slot })
        .eq('medication_id', p.med.id)
        .eq('day', day)
        .eq('time', p.time)
        .lt('last_slot', p.slot)
        .select('medication_id')
      if (error) { console.error('cron claim repeat:', error); continue }
      if (!data?.length) continue
    }
    claimed.push(p)
  }
  if (!claimed.length) return NextResponse.json({ ok: true, hm, due: plan.length, sent: 0 })

  // 7. Suscripciones de esas familias
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', [...new Set(claimed.map((p) => p.med.family_id))])

  let sent = 0
  const jobs: Promise<void>[] = []
  for (const p of claimed) {
    const { med } = p
    const who = `${med.person ? med.person + ' · ' : ''}${med.dose || 'Dosis habitual'}`
    const payload = JSON.stringify({
      title: p.kind === 'repeat' ? `⏰ ${med.name} · sin confirmar` : `💊 ${med.name}`,
      body:
        p.kind === 'repeat'
          ? `${who}. Pasaron ${p.minutesLate} min y aún no lo marcas como tomado.`
          : `${who}. Es momento de tomarlo.`,
      url: '/meds',
      // Mismo tag en toda la serie: en la bandeja queda un solo aviso por dosis que se vuelve a sonar
      tag: `med-${med.id}-${day}-${p.time}`,
    })
    for (const sub of (subs ?? []).filter((s) => s.family_id === med.family_id)) {
      jobs.push(
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          .then(() => { sent++ })
          .catch(async (err: any) => {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            } else {
              console.error('push error:', err?.statusCode)
            }
          })
      )
    }
  }
  await Promise.all(jobs)

  return NextResponse.json({ ok: true, hm, due: plan.length, sent })
}

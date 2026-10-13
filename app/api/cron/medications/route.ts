import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { nowHHMM, todayStr } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  // Ventana de recordatorios: aviso a la hora exacta y luego cada RETRY_EVERY min
  // hasta RETRY_WINDOW min mientras la dosis no esté marcada como tomada.
  // (Asume que el cron se ejecuta cada minuto.)
  const RETRY_EVERY = 5
  const RETRY_WINDOW = 120
  const [h, m] = hm.split(':').map(Number)
  const nowMin = h * 60 + m
  const slots: { time: string; elapsed: number }[] = []
  for (let elapsed = 0; elapsed <= RETRY_WINDOW; elapsed += RETRY_EVERY) {
    const t = nowMin - elapsed
    if (t < 0) break // no cruzar medianoche: dose_logs es por día
    slots.push({ time: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, elapsed })
  }
  const slotTimes = slots.map((s) => s.time)

  // 1. Medicamentos con alguna toma en la ventana
  const { data: meds, error: medsErr } = await supabase
    .from('medications')
    .select('id, name, dose, person, family_id, times')
    .overlaps('times', slotTimes)
  if (medsErr) {
    console.error('cron meds:', medsErr)
    return NextResponse.json({ error: 'Error consultando medicamentos' }, { status: 500 })
  }
  if (!meds?.length) return NextResponse.json({ ok: true, hm, sent: 0 })

  // 2. Solo familias con push activado
  const famIds = [...new Set(meds.map((m) => m.family_id))]
  const { data: fams } = await supabase.from('families').select('id, reminder_push').in('id', famIds)
  const pushOn = new Set((fams ?? []).filter((f) => f.reminder_push).map((f) => f.id))

  // 3. Omitir dosis ya marcadas como tomadas hoy (por medicamento + horario)
  const { data: logs } = await supabase
    .from('dose_logs')
    .select('medication_id, time')
    .eq('day', day)
    .in('time', slotTimes)
    .in('medication_id', meds.map((m) => m.id))
  const taken = new Set((logs ?? []).map((l) => `${l.medication_id}_${String(l.time).slice(0, 5)}`))

  const due: { med: (typeof meds)[number]; scheduledTime: string; elapsed: number }[] = []
  for (const med of meds) {
    if (!pushOn.has(med.family_id)) continue
    const medTimes: string[] = Array.isArray(med.times) ? med.times : []
    for (const s of slots) {
      if (medTimes.includes(s.time) && !taken.has(`${med.id}_${s.time}`)) {
        due.push({ med, scheduledTime: s.time, elapsed: s.elapsed })
      }
    }
  }
  if (!due.length) return NextResponse.json({ ok: true, hm, sent: 0 })

  // 4. Suscripciones de esas familias
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', [...new Set(due.map((d) => d.med.family_id))])

  let sent = 0
  const jobs: Promise<void>[] = []
  for (const { med, scheduledTime, elapsed } of due) {
    const who = `${med.person ? med.person + ' · ' : ''}${med.dose || 'Dosis habitual'}`
    const payload = JSON.stringify({
      title: elapsed > 0 ? `⏰ ${med.name} (pendiente)` : `💊 ${med.name}`,
      body: elapsed > 0
        ? `${who}. Pendiente desde las ${scheduledTime} (hace ${elapsed} min).`
        : `${who}. Es momento de tomarlo.`,
      url: '/meds',
      // Mismo tag por dosis: cada reintento reemplaza al anterior (renotify en sw.js)
      tag: `med-${med.id}-${day}-${scheduledTime}`,
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

  return NextResponse.json({ ok: true, hm, sent })
}
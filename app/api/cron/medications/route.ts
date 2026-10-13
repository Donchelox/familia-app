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

  // 1. Medicamentos con una toma a esta hora
  const { data: meds, error: medsErr } = await supabase
    .from('medications')
    .select('id, name, dose, person, family_id')
    .contains('times', [hm])
  if (medsErr) {
    console.error('cron meds:', medsErr)
    return NextResponse.json({ error: 'Error consultando medicamentos' }, { status: 500 })
  }
  if (!meds?.length) return NextResponse.json({ ok: true, hm, sent: 0 })

  // 2. Solo familias con push activado
  const famIds = [...new Set(meds.map((m) => m.family_id))]
  const { data: fams } = await supabase.from('families').select('id, reminder_push').in('id', famIds)
  const pushOn = new Set((fams ?? []).filter((f) => f.reminder_push).map((f) => f.id))

  // 3. Omitir dosis ya marcadas como tomadas hoy a esta hora
  const { data: logs } = await supabase
    .from('dose_logs')
    .select('medication_id')
    .eq('day', day)
    .eq('time', hm)
    .in('medication_id', meds.map((m) => m.id))
  const taken = new Set((logs ?? []).map((l) => l.medication_id))

  const due = meds.filter((m) => pushOn.has(m.family_id) && !taken.has(m.id))
  if (!due.length) return NextResponse.json({ ok: true, hm, sent: 0 })

  // 4. Suscripciones de esas familias
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', [...new Set(due.map((m) => m.family_id))])

  let sent = 0
  const jobs: Promise<void>[] = []
  for (const med of due) {
    const payload = JSON.stringify({
      title: `💊 ${med.name}`,
      body: `${med.person ? med.person + ' · ' : ''}${med.dose || 'Dosis habitual'}. Es momento de tomarlo.`,
      url: '/meds',
      tag: `med-${med.id}-${hm}`,
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
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:marcealevasquez@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  // Obtener hora actual en Chile (HH:MM)
  const now = new Date()
  const currentHM = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  // Consultar medicamentos programados para esta hora
  const { data: meds, error: medsErr } = await supabase
    .from('medications')
    .select('id, name, dose, schedule_time, family_id')
    .eq('schedule_time', currentHM)

  if (medsErr || !meds || meds.length === 0) {
    return NextResponse.json({ message: `Sin dosis programadas a las ${currentHM}` })
  }

  const results = []

  for (const med of meds) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('family_id', med.family_id)

    if (!subs) continue

    for (const sub of subs) {
      const payload = JSON.stringify({
        title: `💊 Recordatorio: ${med.name}`,
        body: `Dosis: ${med.dose || 'Dosis habitual'}. Es momento de tomarlo.`,
        url: '/medicamentos',
      })

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
        results.push({ sent: true, med: med.name })
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  return NextResponse.json({ ok: true, currentHM, results })
}
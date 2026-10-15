import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization') ?? ''
  const got = Buffer.from(authHeader)
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}))
  const title = body?.title || '👋 Saludo de Casa App'
  const message = body?.message || '¡Hola! ¿Cómo estás?'
  const url = body?.url || '/'

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  // Obtener todas las suscripciones activas
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')

  if (subsErr) {
    return NextResponse.json({ error: 'Error al consultar suscripciones' }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No hay dispositivos suscritos' })
  }

  const payload = JSON.stringify({
    title,
    body: message,
    url,
    tag: `custom-test-${Date.now()}`,
  })

  let sent = 0
  const jobs = subs.map((sub) =>
    webpush
      .sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 600, urgency: 'high' }
      )
      .then(() => {
        sent++
      })
      .catch(async (err: any) => {
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          console.log('Borrando suscripción caducada:', sub.id)
          try {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } catch {}
        } else {
          console.error('Error enviando push personalizado:', status ?? err?.message)
        }
      })
  )

  await Promise.all(jobs)

  return NextResponse.json({
    ok: true,
    totalTargeted: subs.length,
    sent,
    sentTitle: title,
    sentMessage: message,
  })
}

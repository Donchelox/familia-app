import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { nowHHMM, todayStr } from '@/lib/dates'
import { fetchMorningSummary, buildMorningSummaryPushPayload } from '@/lib/morningSummary'

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

/**
 * Endpoint de Cron para el Resumen Matutino
 * Se ejecuta periódicamente y despacha la notificación push a la hora configurada (07:00 AM por defecto)
 */
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
    return NextResponse.json({ error: 'Faltan variables de entorno para push/supabase' }, { status: 500 })
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const hm = nowHHMM() // Hora actual en Chile 'HH:MM'
  const day = todayStr()
  const url = new URL(req.url)
  const isForce = url.searchParams.get('force') === 'true'

  // 1. Obtener todas las familias
  const { data: families, error: famErr } = await supabase
    .from('families')
    .select('id, reminder_push, reminder_email')

  if (famErr || !families) {
    return NextResponse.json({ error: 'Error consultando familias' }, { status: 500 })
  }

  // 2. Obtener miembros administradores para consultar preferencias de horario
  const famIds = families.map((f) => f.id)
  const { data: adminMembers } = await supabase
    .from('members')
    .select('family_id, user_id')
    .eq('role', 'admin')
    .in('family_id', famIds)

  const familyTimes = new Map<string, { enabled: boolean; time: string }>()

  // Por defecto, cada familia tiene el resumen activado a las 07:00 AM
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

  // 3. Filtrar familias cuyo horario coincida con la hora actual
  const dueFamilies: string[] = []
  for (const [famId, conf] of familyTimes.entries()) {
    if (!conf.enabled) continue
    if (isForce || conf.time === hm) {
      dueFamilies.push(famId)
    }
  }

  if (dueFamilies.length === 0) {
    return NextResponse.json({ ok: true, hm, scheduled: 0, sent: 0 })
  }

  // 4. Deduplicación: revisar si ya se envió hoy el resumen a esa familia
  const dedupTag = `morning_summary_${day}`
  const { data: existingLogs } = await supabase
    .from('activity_log')
    .select('family_id')
    .eq('module', 'Resumen Matutino')
    .eq('action', 'notificado')
    .eq('item', dedupTag)
    .in('family_id', dueFamilies)

  const alreadySentFamilies = new Set((existingLogs ?? []).map((l) => l.family_id))
  const targetFamilies = isForce
    ? dueFamilies
    : dueFamilies.filter((id) => !alreadySentFamilies.has(id))

  if (targetFamilies.length === 0) {
    return NextResponse.json({ ok: true, hm, scheduled: dueFamilies.length, sent: 0, note: 'Ya notificado hoy' })
  }

  // 5. Suscripciones push de las familias destinatarias
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, family_id, endpoint, p256dh, auth')
    .in('family_id', targetFamilies)

  let sent = 0
  const jobs: Promise<void>[] = []

  for (const famId of targetFamilies) {
    const summary = await fetchMorningSummary(supabase, famId, day)
    const payload = JSON.stringify(buildMorningSummaryPushPayload(summary))
    const famSubs = (subs ?? []).filter((s) => s.family_id === famId)

    const sendOptions = { TTL: 1200, urgency: 'high' as const, timeout: 10000 }

    for (const sub of famSubs) {
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
            const status = err?.statusCode
            if (status === 404 || status === 410 || !status) {
              console.error(`Suscripción push inválida en resumen matutino (status: ${status ?? 'sin status'}), eliminando suscripción ID:`, sub.id)
              try {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id)
              } catch {}
            } else {
              console.error('Push error en resumen matutino status:', status)
            }
          })
      )
    }

    // Registrar en activity_log para deduplicación y auditoría
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

  return NextResponse.json({
    ok: true,
    hm,
    targetedFamilies: targetFamilies.length,
    sent,
  })
}

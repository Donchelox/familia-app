import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { dispatchTodoReminders } from '@/lib/modularNotifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // Permitir si no hay secreto configurado localmente
  const authHeader = req.headers.get('authorization') ?? ''
  const got = Buffer.from(authHeader)
  const want = Buffer.from(`Bearer ${secret}`)
  return got.length === want.length && timingSafeEqual(got, want)
}

/**
 * Cron para enviar Notificaciones Push de Tareas y Subtareas pendientes al llegar su fecha/hora límite
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

  if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Faltan variables de entorno de Supabase' }, { status: 500 })
  }

  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const hasVapid = NEXT_PUBLIC_VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
  if (hasVapid) {
    webpush.setVapidDetails(VAPID_SUBJECT!, NEXT_PUBLIC_VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!)
  }

  try {
    const sentCount = await dispatchTodoReminders(supabase, webpush)
    return NextResponse.json({
      ok: true,
      pushSent: sentCount,
    })
  } catch (err: any) {
    console.error('[Cron Todos] Error general:', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

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

  const nowIso = new Date().toISOString()

  try {
    // Buscar tareas no completadas cuya fecha límite ya llegó o está por vencer y aún no tienen alerta enviada
    const { data: dueTodos, error: todosErr } = await supabase
      .from('todos')
      .select('id, family_id, title, details, assigned_to, due_date, subtasks, reminder_sent')
      .eq('done', false)
      .eq('reminder_sent', false)
      .not('due_date', 'is', null)
      .lte('due_date', nowIso)
      .limit(50)

    if (todosErr) {
      console.error('[Cron Todos] Error consultando tareas:', todosErr)
      return NextResponse.json({ error: todosErr.message }, { status: 500 })
    }

    if (!dueTodos || dueTodos.length === 0) {
      return NextResponse.json({ ok: true, message: 'No hay recordatorios pendientes para enviar ahora.', sent: 0 })
    }

    let sentCount = 0

    // Agrupar por familia para buscar sus suscripciones push
    const familyIds = Array.from(new Set(dueTodos.map((t) => t.family_id).filter(Boolean)))

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, family_id, user_id, endpoint, p256dh, auth')
      .in('family_id', familyIds)

    const subsByFamily = new Map<string, any[]>()
    if (subs) {
      for (const s of subs) {
        const list = subsByFamily.get(s.family_id) || []
        list.push(s)
        subsByFamily.set(s.family_id, list)
      }
    }

    const completedIds: string[] = []

    for (const todo of dueTodos) {
      const familySubs = subsByFamily.get(todo.family_id) || []

      if (hasVapid && familySubs.length > 0) {
        const payload = JSON.stringify({
          title: `🔔 Tarea del hogar: ${todo.title}`,
          body: todo.assigned_to
            ? `Asignada a ${todo.assigned_to}. ${todo.details ? `Detalles: ${todo.details}` : 'Llegó el momento de realizarla.'}`
            : todo.details || 'Llegó la hora de realizar esta tarea del hogar.',
          url: '/tareas',
          tag: `todo-${todo.id}`,
        })

        const sendOptions = { TTL: 3600, urgency: 'high' as const }

        await Promise.all(
          familySubs.map(async (sub) => {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                sendOptions
              )
              sentCount++
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                try {
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                } catch {
                  // Silently ignore cleanup error
                }
              }
            }
          })
        )
      }

      completedIds.push(todo.id)
    }

    // Marcar recordatorio como enviado para evitar duplicados
    if (completedIds.length > 0) {
      try {
        await supabase
          .from('todos')
          .update({ reminder_sent: true })
          .in('id', completedIds)
      } catch (e) {
        console.warn('[Cron Todos] Error al marcar reminder_sent:', e)
      }
    }

    return NextResponse.json({
      ok: true,
      tasksAlerted: completedIds.length,
      pushSent: sentCount,
    })
  } catch (err: any) {
    console.error('[Cron Todos] Error general:', err)
    return NextResponse.json({ error: err?.message || 'Error interno' }, { status: 500 })
  }
}

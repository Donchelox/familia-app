import { NextResponse } from 'next/server'
import { getApiContext } from '@/lib/family'

const P256DH_RE = /^[A-Za-z0-9_-]{80,100}$/
const AUTH_RE = /^[A-Za-z0-9_-]{20,30}$/

function checkOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    const originHost = new URL(origin).host.toLowerCase()
    const forwardedHost = req.headers.get('x-forwarded-host')?.toLowerCase()
    const hostHeader = req.headers.get('host')?.toLowerCase()
    const requestHost = new URL(req.url).host.toLowerCase()

    if (forwardedHost && originHost === forwardedHost) return true
    if (hostHeader && originHost === hostHeader) return true
    if (originHost === requestHost) return true

    return false
  } catch {
    return false
  }
}

function isValidEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 2000) return false
  try {
    const u = new URL(endpoint)
    if (u.protocol !== 'https:') return false
    if (u.port !== '' || u.username !== '' || u.password !== '') return false

    const h = u.hostname.toLowerCase()
    const isAllowedHost =
      h === 'fcm.googleapis.com' ||
      h === 'updates.push.services.mozilla.com' ||
      h === 'web.push.apple.com' ||
      h === 'notify.windows.com' ||
      h.endsWith('.notify.windows.com')

    return isAllowedHost
  } catch {
    return false
  }
}

function isValidKeys(p256dh: unknown, auth: unknown): boolean {
  return (
    typeof p256dh === 'string' &&
    P256DH_RE.test(p256dh) &&
    typeof auth === 'string' &&
    AUTH_RE.test(auth)
  )
}

export async function POST(req: Request) {
  // 2.3 Comprobar Origin igual al del request (403 si no coincide)
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Origin no permitido' }, { status: 403 })
  }

  // 2.6 Respuesta 401 limpia si no hay sesión
  const ctx = await getApiContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.p256dh
  const auth = body?.auth

  // 2.1 y 2.2 Validaciones estrictas de endpoint y claves VAPID
  if (!isValidEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Endpoint push inválido o no permitido' }, { status: 400 })
  }

  if (!isValidKeys(p256dh, auth)) {
    return NextResponse.json({ error: 'Claves criptográficas de suscripción inválidas' }, { status: 400 })
  }

  // 2.4 Tope de 10 suscripciones por usuario (429)
  const { data: existing } = await ctx.supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .eq('user_id', ctx.user.id)
    .maybeSingle()

  if (!existing) {
    const { count, error: countErr } = await ctx.supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)

    if (!countErr && (count ?? 0) >= 10) {
      return NextResponse.json(
        { error: 'Límite de 10 suscripciones por usuario alcanzado' },
        { status: 429 }
      )
    }
  }

  // 2.5 Usar la función register_push_subscription (1.10) con fallback a upsert
  const { error: rpcErr } = await ctx.supabase.rpc('register_push_subscription', {
    endpoint_val: endpoint,
    p256dh_val: p256dh,
    auth_val: auth,
    family_id_val: ctx.familyId,
  })

  if (rpcErr) {
    const { error: upsertErr } = await ctx.supabase.from('push_subscriptions').upsert(
      {
        user_id: ctx.user.id,
        family_id: ctx.familyId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'endpoint' }
    )
    if (upsertErr) {
      console.error('push/subscribe error:', rpcErr, upsertErr)
      return NextResponse.json({ error: 'No se pudo guardar la suscripción' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  // 2.3 Comprobar Origin
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Origin no permitido' }, { status: 403 })
  }

  // 2.6 Respuesta 401 limpia si no hay sesión
  const ctx = await getApiContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint

  if (!isValidEndpoint(endpoint)) {
    return NextResponse.json({ error: 'Endpoint inválido' }, { status: 400 })
  }

  // 2.7 Borrar la suscripción del usuario actual por endpoint
  const { error } = await ctx.supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', ctx.user.id)

  if (error) {
    console.error('push/unsubscribe error:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la suscripción' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
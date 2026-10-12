import { NextResponse } from 'next/server'
import { getContext } from '@/lib/family'

export async function POST(req: Request) {
  // La familia sale de la sesión, no de lo que mande el cliente
  const ctx = await getContext()

  const body = await req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.p256dh
  const auth = body?.auth

  if (
    typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 2000 ||
    typeof p256dh !== 'string' || p256dh.length > 200 ||
    typeof auth !== 'string' || auth.length > 100
  ) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { error } = await ctx.supabase.from('push_subscriptions').upsert(
    {
      user_id: ctx.user.id,
      family_id: ctx.familyId,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('push/subscribe:', error)
    return NextResponse.json({ error: 'No se pudo guardar la suscripción' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
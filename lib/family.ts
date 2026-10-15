import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { createClient as createAdminClient } from '@supabase/supabase-js'

export type Role = 'admin' | 'editor' | 'viewer'
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  editor: 'Puede editar',
  viewer: 'Solo ver',
}

/** Reclama invitaciones pendientes para el usuario de forma infalible */
async function claimPendingInvites(supabase: any, user: { id: string; email?: string | null; user_metadata?: any }) {
  if (!user.email) return

  const cleanEmail = user.email.trim().toLowerCase()
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    cleanEmail.split('@')[0]

  // 1. Intentar con RPC pasando target_email explícito
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('claim_invites', { target_email: cleanEmail })
    if (!rpcErr && typeof rpcRes === 'number' && rpcRes > 0) return
  } catch {}

  // 2. Intentar RPC clásico sin parámetros por si la función no ha sido actualizada en la BD
  try {
    await supabase.rpc('claim_invites')
  } catch {}

  // 3. Fallback infalible con service role si está disponible
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (serviceKey && url) {
    try {
      const admin = createAdminClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      // Buscar si tiene alguna invitación pendiente por correo
      const { data: invite } = await admin
        .from('invites')
        .select('id, family_id, role, email')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle()

      if (invite) {
        // Insertar membresía con el rol de la invitación
        await admin
          .from('members')
          .upsert(
            {
              family_id: invite.family_id,
              user_id: user.id,
              email: cleanEmail,
              display_name: displayName,
              role: invite.role,
            },
            { onConflict: 'family_id,user_id' }
          )

        // Eliminar la invitación
        await admin.from('invites').delete().eq('id', invite.id)

        // Vincular user_id en family_members si hay un registro de adulto
        await admin
          .from('family_members')
          .update({ user_id: user.id })
          .eq('family_id', invite.family_id)
          .is('user_id', null)
          .eq('type', 'adult')
      }
    } catch (e) {
      console.error('Error en fallback de reclamo de invitación:', e)
    }
  }
}

/** Usuario + familia activa. Reclama invitaciones o manda a crear familia. */
export const getContext = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const query = () =>
    supabase
      .from('members')
      .select('family_id, role, display_name, families(name, reminder_email, reminder_push)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

  let { data: m } = await query()
  if (!m) {
    await claimPendingInvites(supabase, user)
    const retry = await query()
    m = retry.data
  }
  if (!m) redirect('/onboarding')

  const fam = Array.isArray(m.families) ? m.families[0] : m.families
  return {
    supabase,
    user,
    familyId: m.family_id as string,
    role: m.role as Role,
    familyName: (fam?.name ?? 'Mi familia') as string,
    name: (m.display_name || user.email || 'Alguien') as string,
    reminderEmail: (fam?.reminder_email ?? true) as boolean,
    reminderPush: (fam?.reminder_push ?? true) as boolean,
  }
})

export type Ctx = Awaited<ReturnType<typeof getContext>>

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'editor' | 'viewer'
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  editor: 'Puede editar',
  viewer: 'Solo ver',
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
    await supabase.rpc('claim_invites')
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

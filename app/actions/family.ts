'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/family'
import { str, refresh } from '@/lib/util'
import {
  InviteMemberSchema,
  SetRoleSchema,
  UUID_SCHEMA,
  SetRemindersSchema,
} from '@/lib/validations/schemas'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function inviteMember(fd: FormData) {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  const parsed = InviteMemberSchema.safeParse({
    email: str(fd, 'email'),
    role: str(fd, 'role'),
  })
  if (!parsed.success) return

  const { email, role } = parsed.data
  await supabase.from('invites').upsert(
    { family_id: familyId, email, role },
    { onConflict: 'family_id,email' }
  )
  refresh()
}

export async function setRole(fd: FormData) {
  const { supabase, user, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  const parsed = SetRoleSchema.safeParse({
    user_id: str(fd, 'user_id'),
    role: str(fd, 'role'),
  })
  if (!parsed.success) return
  if (parsed.data.user_id === user.id) return // evita que el admin se degrade a sí mismo

  await supabase
    .from('members')
    .update({ role: parsed.data.role })
    .eq('family_id', familyId)
    .eq('user_id', parsed.data.user_id)
  refresh()
}

export async function removeMember(fd: FormData) {
  const { supabase, user, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  const parsed = UUID_SCHEMA.safeParse(str(fd, 'user_id'))
  if (!parsed.success) return
  if (parsed.data === user.id) return

  await supabase.from('members').delete().eq('family_id', familyId).eq('user_id', parsed.data)
  refresh()
}

export async function cancelInvite(fd: FormData) {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  const parsed = UUID_SCHEMA.safeParse(str(fd, 'id'))
  if (!parsed.success) return

  await supabase.from('invites').delete().eq('family_id', familyId).eq('id', parsed.data)
  refresh()
}

export async function setReminders(fd: FormData) {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  const parsed = SetRemindersSchema.safeParse({
    email: fd.get('email') === 'on',
    push: fd.get('push') === 'on',
  })
  if (!parsed.success) return

  await supabase
    .from('families')
    .update({ reminder_email: parsed.data.email, reminder_push: parsed.data.push })
    .eq('id', familyId)
  refresh()
}

export async function clearLog() {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return

  await supabase.from('activity_log').delete().eq('family_id', familyId)
  refresh()
}
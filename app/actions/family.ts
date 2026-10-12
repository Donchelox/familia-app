'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/family'
import { str, refresh } from '@/lib/util'

const ROLES = ['admin', 'editor', 'viewer']
const emailOk = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
export async function inviteMember(fd: FormData) {
  const { supabase, familyId } = await getContext()
  const email = str(fd, 'email').toLowerCase()
  const role = str(fd, 'role')
  if (!emailOk(email) || !ROLES.includes(role)) return
  await supabase.from('invites').upsert(
    { family_id: familyId, email, role },
    { onConflict: 'family_id,email' }
  )
  refresh()
}
export async function setRole(fd: FormData) {
  const { supabase, user, familyId } = await getContext()
  const uid = str(fd, 'user_id')
  const role = str(fd, 'role')
  if (uid === user.id) return // evita quedarse sin administrador
  if (!ROLES.includes(role)) return
  await supabase.from('members').update({ role }).eq('family_id', familyId).eq('user_id', uid)
  refresh()
}
export async function removeMember(fd: FormData) {
  const { supabase, user, familyId } = await getContext()
  const uid = str(fd, 'user_id')
  if (uid === user.id) return
  await supabase.from('members').delete().eq('family_id', familyId).eq('user_id', uid)
  refresh()
}
export async function cancelInvite(fd: FormData) {
  const { supabase, familyId } = await getContext()
  await supabase.from('invites').delete().eq('family_id', familyId).eq('id', str(fd, 'id'))
  refresh()
}
export async function setReminders(fd: FormData) {
  const { supabase, familyId } = await getContext()
  await supabase.from('families')
    .update({ reminder_email: fd.get('email') === 'on', reminder_push: fd.get('push') === 'on' })
    .eq('id', familyId)
  refresh()
}
export async function clearLog() {
  const { supabase, familyId } = await getContext()
  await supabase.from('activity_log').delete().eq('family_id', familyId)
  refresh()
}
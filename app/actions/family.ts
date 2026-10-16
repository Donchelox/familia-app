'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/family'
import { str, refresh, type ActionResult } from '@/lib/util'
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

export async function inviteMember(fd: FormData): Promise<ActionResult> {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede invitar miembros.' }

  const parsed = InviteMemberSchema.safeParse({
    email: str(fd, 'email'),
    role: str(fd, 'role'),
  })
  if (!parsed.success) return { ok: false, error: 'Correo o rol inválido.' }

  const { email, role } = parsed.data
  const { error } = await supabase.from('invites').upsert(
    { family_id: familyId, email, role },
    { onConflict: 'family_id,email' }
  )
  if (error) return { ok: false, error: 'No se pudo crear la invitación.' }

  refresh()
  return { ok: true }
}

export async function setRole(fd: FormData): Promise<ActionResult> {
  const { supabase, user, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede cambiar roles.' }

  const parsed = SetRoleSchema.safeParse({
    user_id: str(fd, 'user_id'),
    role: str(fd, 'role'),
  })
  if (!parsed.success) return { ok: false, error: 'Datos de rol inválidos.' }
  if (parsed.data.user_id === user.id) return { ok: false, error: 'No puedes cambiar tu propio rol.' }

  const { error } = await supabase
    .from('members')
    .update({ role: parsed.data.role })
    .eq('family_id', familyId)
    .eq('user_id', parsed.data.user_id)

  if (error) return { ok: false, error: 'No se pudo actualizar el rol.' }

  refresh()
  return { ok: true }
}

export async function removeMember(fd: FormData): Promise<ActionResult> {
  const { supabase, user, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede eliminar miembros.' }

  const parsed = UUID_SCHEMA.safeParse(str(fd, 'user_id'))
  if (!parsed.success) return { ok: false, error: 'ID de usuario inválido.' }
  if (parsed.data === user.id) return { ok: false, error: 'No puedes eliminarte a ti mismo.' }

  const { error } = await supabase.from('members').delete().eq('family_id', familyId).eq('user_id', parsed.data)
  if (error) return { ok: false, error: 'No se pudo eliminar el miembro.' }

  refresh()
  return { ok: true }
}

export async function cancelInvite(fd: FormData): Promise<ActionResult> {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede cancelar invitaciones.' }

  const parsed = UUID_SCHEMA.safeParse(str(fd, 'id'))
  if (!parsed.success) return { ok: false, error: 'ID de invitación inválido.' }

  const { error } = await supabase.from('invites').delete().eq('family_id', familyId).eq('id', parsed.data)
  if (error) return { ok: false, error: 'No se pudo cancelar la invitación.' }

  refresh()
  return { ok: true }
}

export async function setReminders(fd: FormData): Promise<ActionResult> {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede configurar recordatorios.' }

  const parsed = SetRemindersSchema.safeParse({
    email: fd.get('email') === 'on',
    push: fd.get('push') === 'on',
  })
  if (!parsed.success) return { ok: false, error: 'Preferencias inválidas.' }

  const { error } = await supabase
    .from('families')
    .update({ reminder_email: parsed.data.email, reminder_push: parsed.data.push })
    .eq('id', familyId)

  if (error) return { ok: false, error: 'No se pudieron guardar las preferencias.' }

  refresh()
  return { ok: true }
}

export async function clearLog(): Promise<ActionResult> {
  const { supabase, familyId, role: currentRole } = await getContext()
  if (currentRole !== 'admin') return { ok: false, error: 'Solo el administrador puede vaciar el historial.' }

  const { error } = await supabase.from('activity_log').delete().eq('family_id', familyId)
  if (error) return { ok: false, error: 'No se pudo vaciar el registro.' }

  refresh()
  return { ok: true }
}
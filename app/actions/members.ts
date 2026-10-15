'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getContext } from '@/lib/family'

export type MemberActionResult = { ok: boolean; message?: string; error?: string }

const emailOk = (s: string) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)

/** Envía el correo de invitación. Si la persona ya tiene cuenta, le manda un código de acceso. */
async function sendInviteEmail(email: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey || !anonKey) return 'Faltan variables de entorno de Supabase'

  const h = await headers()
  // URL pública fija de la app: si se invita desde localhost, el enlace igual debe llevar a producción
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || h.get('origin') || `https://${h.get('host')}`).replace(/\/$/, '')
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }

  const admin = createAdminClient(url, serviceKey, opts)
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/login` })
  if (!error) return null

  // Ya registrado: se le envía un código de acceso (cliente aparte, no toca la sesión actual)
  if (/already|registered|exists/i.test(error.message)) {
    const anon = createAdminClient(url, anonKey, opts)
    const { error: otpErr } = await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    return otpErr ? otpErr.message : null
  }
  return error.message
}

export async function updateAccount(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const fullName = (formData.get('fullName') as string)?.trim()
  const familyName = (formData.get('familyName') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()

  // 1. Actualizar metadatos del usuario y correo si cambió
  const authUpdatePayload: { email?: string; data: { full_name?: string; name?: string } } = {
    data: {},
  }

  if (fullName) {
    authUpdatePayload.data.full_name = fullName
    authUpdatePayload.data.name = fullName
  }

  if (email) {
    const { data: userRes } = await supabase.auth.getUser()
    if (userRes.user?.email && userRes.user.email.toLowerCase() !== email.toLowerCase()) {
      authUpdatePayload.email = email
    }
  }

  await supabase.auth.updateUser(authUpdatePayload)

  // 2. Actualizar el nombre de la familia en la tabla `families`
  if (familyName && familyId) {
    await supabase
      .from('families')
      .update({ name: familyName })
      .eq('id', familyId)
  }

  revalidatePath('/ajustes')
  revalidatePath('/')
}

export async function addFamilyMember(formData: FormData): Promise<MemberActionResult> {
  const { supabase, familyId, role: myRole } = await getContext()
  if (myRole !== 'admin') return { ok: false, error: 'Solo el administrador puede añadir integrantes.' }

  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string)?.trim() || 'hijo'
  const type = (formData.get('type') as string)?.trim() || 'child'
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()

  if (!name) return { ok: false, error: 'Falta el nombre.' }
  if (type === 'adult' && !emailOk(email)) return { ok: false, error: 'Ingresa un correo válido.' }

  // Adulto: invitación con rol "editor" (no administra integrantes). claim_invites la convierte
  // en membresía cuando la persona entra con ese correo.
  if (type === 'adult') {
    const { error: invErr } = await supabase
      .from('invites')
      .upsert({ family_id: familyId, email, role: 'editor' }, { onConflict: 'family_id,email' })
    if (invErr) return { ok: false, error: 'No se pudo crear la invitación.' }
  }

  const { error: insErr } = await supabase.from('family_members').insert({
    family_id: familyId,
    name,
    role,
    type,
  })
  if (insErr) return { ok: false, error: 'No se pudo guardar el integrante.' }

  revalidatePath('/ajustes')
  revalidatePath('/')

  if (type === 'adult') {
    const mailErr = await sendInviteEmail(email)
    if (mailErr) {
      console.error('invite email:', mailErr)
      return { ok: true, message: `Invitación creada, pero no se pudo enviar el correo. ${name} puede entrar igual con ${email}.` }
    }
    return { ok: true, message: `Invitación enviada a ${email}.` }
  }
  return { ok: true }
}

export async function updateFamilyMember(formData: FormData): Promise<MemberActionResult> {
  const { supabase, familyId, role: myRole } = await getContext()
  if (myRole !== 'admin') return { ok: false, error: 'Solo el administrador puede editar integrantes.' }
  const memberId = formData.get('memberId') as string
  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string)?.trim() || 'hijo'
  const type = (formData.get('type') as string)?.trim() || 'child'
  // Opcional al editar: si se ingresa, se invita a ese adulto como editor
  const email = ((formData.get('email') as string) ?? '').trim().toLowerCase()

  if (!memberId || !name) return { ok: false, error: 'Falta el nombre.' }
  const invite = type === 'adult' && email !== ''
  if (invite && !emailOk(email)) return { ok: false, error: 'Ingresa un correo válido.' }

  if (invite) {
    const { error: invErr } = await supabase
      .from('invites')
      .upsert({ family_id: familyId, email, role: 'editor' }, { onConflict: 'family_id,email' })
    if (invErr) return { ok: false, error: 'No se pudo crear la invitación.' }
  }

  const { error: updErr } = await supabase
    .from('family_members')
    .update({ name, role, type })
    .eq('id', memberId)
    .eq('family_id', familyId)
  if (updErr) return { ok: false, error: 'No se pudo actualizar el integrante.' }

  revalidatePath('/ajustes')
  revalidatePath('/')

  if (invite) {
    const mailErr = await sendInviteEmail(email)
    if (mailErr) {
      console.error('invite email:', mailErr)
      return { ok: true, message: `Invitación creada, pero no se pudo enviar el correo. ${name} puede entrar igual con ${email}.` }
    }
    return { ok: true, message: `Invitación enviada a ${email}.` }
  }
  return { ok: true }
}

export async function deleteFamilyMember(formData: FormData) {
  const { supabase, familyId, role: myRole } = await getContext()
  if (myRole !== 'admin') return
  const memberId = formData.get('memberId') as string

  if (!memberId) return

  await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
    .eq('family_id', familyId)

  revalidatePath('/ajustes')
  revalidatePath('/')
}

export async function signOut() {
  const { supabase } = await getContext()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function updatePreferences(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const medReminders = formData.get('medReminders') === 'true'
  const morningSummary = formData.get('morningSummary') === 'true'

  // Guarda en la tabla families (o user metadata como fallback)
  await supabase
    .from('families')
    .update({
      med_reminders_enabled: medReminders,
      morning_summary_enabled: morningSummary,
    })
    .eq('id', familyId)

  // Guardamos también en los metadatos del usuario para disponibilidad inmediata
  await supabase.auth.updateUser({
    data: {
      med_reminders_enabled: medReminders,
      morning_summary_enabled: morningSummary,
    },
  })

  revalidatePath('/ajustes')
  revalidatePath('/')
}
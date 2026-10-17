'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getContext } from '@/lib/family'
import { translateErrorMessage } from '@/lib/formatErrors'
import { recordActivity } from '@/lib/audit'

import {
  UpdateAccountSchema,
  FamilyMemberSchema,
  UpdateFamilyMemberSchema,
  UpdatePreferencesSchema,
  UUID_SCHEMA,
} from '@/lib/validations/schemas'

export type MemberActionResult = { ok: boolean; message?: string; error?: string }

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
    return otpErr ? translateErrorMessage(otpErr) : null
  }
  return translateErrorMessage(error)
}

export async function updateAccount(formData: FormData) {
  const { supabase, familyId, role: myRole } = await getContext()

  const parsed = UpdateAccountSchema.safeParse({
    fullName: formData.get('fullName') || undefined,
    familyName: formData.get('familyName') || undefined,
    email: formData.get('email') || undefined,
  })
  if (!parsed.success) return

  const { fullName, familyName, email } = parsed.data

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

  if (Object.keys(authUpdatePayload.data).length > 0 || authUpdatePayload.email) {
    await supabase.auth.updateUser(authUpdatePayload)
  }

  // 2. Solo el administrador puede actualizar el nombre de la familia en la tabla `families`
  if (familyName && familyId && myRole === 'admin') {
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

  const parsed = FamilyMemberSchema.safeParse({
    name: formData.get('name'),
    role: formData.get('role') || 'hijo',
    type: formData.get('type') || 'child',
    email: formData.get('email') ?? '',
  })
  if (!parsed.success) return { ok: false, error: 'Datos del integrante inválidos.' }

  const { name, role, type, email } = parsed.data
  if (type === 'adult' && !email) return { ok: false, error: 'Ingresa un correo válido.' }

  // Adulto: invitación con rol "editor" (no administra integrantes). claim_invites la convierte
  // en membresía cuando la persona entra con ese correo.
  if (type === 'adult' && email) {
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

  await recordActivity(supabase, {
    familyId,
    actorName: 'Administrador',
    entity: 'member',
    action: 'create',
    title: `Integrante añadido: ${name} (${role})`,
  })

  revalidatePath('/ajustes')
  revalidatePath('/ajustes/integrantes')
  revalidatePath('/')

  if (type === 'adult' && email) {
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

  const parsed = UpdateFamilyMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    name: formData.get('name'),
    role: formData.get('role') || 'hijo',
    type: formData.get('type') || 'child',
    email: formData.get('email') ?? '',
  })
  if (!parsed.success) return { ok: false, error: 'Datos del integrante inválidos.' }

  const { memberId, name, role, type, email } = parsed.data
  const invite = type === 'adult' && Boolean(email)

  if (invite && email) {
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

  await recordActivity(supabase, {
    familyId,
    actorName: 'Administrador',
    entity: 'member',
    action: 'update',
    title: `Integrante editado: ${name} (${role})`,
  })

  revalidatePath('/ajustes')
  revalidatePath('/ajustes/integrantes')
  revalidatePath('/')

  if (invite && email) {
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

  const parsed = UUID_SCHEMA.safeParse(formData.get('memberId'))
  if (!parsed.success) return
  const memberId = parsed.data

  const { data: member } = await supabase
    .from('family_members')
    .select('name')
    .eq('id', memberId)
    .eq('family_id', familyId)
    .maybeSingle()

  await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
    .eq('family_id', familyId)

  await recordActivity(supabase, {
    familyId,
    actorName: 'Administrador',
    entity: 'member',
    action: 'delete',
    title: `Integrante eliminado: ${member?.name || 'Miembro del hogar'}`,
  })

  revalidatePath('/ajustes')
  revalidatePath('/ajustes/integrantes')
  revalidatePath('/')
}

export async function signOut() {
  try {
    const supabase = await createServerClient()
    await supabase.auth.signOut()
  } catch (err) {
    console.debug('[Server signOut] error cerrando sesión:', err)
  }
  redirect('/login')
}

export async function updatePreferences(formData: FormData) {
  const { supabase, familyId, role: myRole } = await getContext()

  const rawFeriaDays = (formData.get('feriaDays') as string)?.trim()
  const parsed = UpdatePreferencesSchema.safeParse({
    medReminders: formData.get('medReminders') === 'true',
    reminderPushDetail: formData.get('reminderPushDetail') === 'true',
    morningSummary: formData.get('morningSummary') === 'true',
    medReminderInterval: formData.get('medReminderInterval'),
    morningSummaryTime: formData.get('morningSummaryTime'),
    schoolReminders: formData.get('schoolReminders') !== 'false',
    schoolReminderTime: formData.get('schoolReminderTime'),
    feriaReminders: formData.get('feriaReminders') !== 'false',
    feriaDays: rawFeriaDays ? rawFeriaDays.split(',').map((d) => d.trim()).filter(Boolean) : ['Jueves', 'Domingo'],
    feriaTime: formData.get('feriaTime'),
    superReminders: formData.get('superReminders') !== 'false',
    superTime: formData.get('superTime'),
  })
  if (!parsed.success) return { ok: false, error: 'Preferencias inválidas' }

  const {
    medReminders,
    reminderPushDetail,
    morningSummary,
    medReminderInterval,
    morningSummaryTime,
    schoolReminders,
    schoolReminderTime,
    feriaReminders,
    feriaDays,
    feriaTime,
    superReminders,
    superTime,
  } = parsed.data

  // Solo el administrador puede modificar la configuración compartida en la tabla families
  if (myRole === 'admin') {
    const { error: famError } = await supabase
      .from('families')
      .update({
        reminder_push: medReminders,
        reminder_email: morningSummary,
        med_reminder_interval: medReminderInterval,
        reminder_push_detail: reminderPushDetail,
      })
      .eq('id', familyId)

    if (famError) {
      console.warn('updatePreferences families fallback warning:', famError.message)
      // Si las columnas extendidas aún no existen en la BD, guarda al menos los flags base
      await supabase
        .from('families')
        .update({
          reminder_push: medReminders,
          reminder_email: morningSummary,
        })
        .eq('id', familyId)
    }
  }

  // Guardamos también en los metadatos del usuario para disponibilidad inmediata y sincronización con el cron
  await supabase.auth.updateUser({
    data: {
      reminder_push: medReminders,
      reminder_email: morningSummary,
      med_reminders_enabled: medReminders,
      reminder_push_detail: reminderPushDetail,
      morning_summary_enabled: morningSummary,
      morning_summary_time: morningSummaryTime,
      med_reminder_interval: medReminderInterval,
      // Modulares
      school_reminders_enabled: schoolReminders,
      school_reminder_time: schoolReminderTime,
      feria_reminders_enabled: feriaReminders,
      feria_days: feriaDays,
      feria_time: feriaTime,
      super_reminders_enabled: superReminders,
      super_time: superTime,
    },
  })

  await recordActivity(supabase, {
    familyId,
    actorName: 'Familiar',
    entity: 'member',
    action: 'update',
    title: `Preferencias: Medicinas (${medReminderInterval}m), Resumen (${morningSummaryTime} hrs), Feria (${feriaDays.join('/')} a las ${feriaTime} hrs), Colegio (${schoolReminderTime} hrs)`,
  })

  revalidatePath('/ajustes')
  revalidatePath('/ajustes/preferencias')
  revalidatePath('/')
  return { ok: true }
}
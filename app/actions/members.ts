'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getContext } from '@/lib/family'

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

export async function addFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string)?.trim() || 'hijo'
  const type = (formData.get('type') as string)?.trim() || 'child'

  if (!name) return

  await supabase.from('family_members').insert({
    family_id: familyId,
    name,
    role,
    type,
  })

  revalidatePath('/ajustes')
  revalidatePath('/')
}

export async function updateFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const memberId = formData.get('memberId') as string
  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string)?.trim() || 'hijo'
  const type = (formData.get('type') as string)?.trim() || 'child'

  if (!memberId || !name) return

  await supabase
    .from('family_members')
    .update({ name, role, type })
    .eq('id', memberId)
    .eq('family_id', familyId)

  revalidatePath('/ajustes')
  revalidatePath('/')
}

export async function deleteFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()
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
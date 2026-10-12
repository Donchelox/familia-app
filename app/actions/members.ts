'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getContext } from '@/lib/family'

export async function updateAccount(formData: FormData) {
  const { supabase } = await getContext()
  const fullName = (formData.get('fullName') as string)?.trim()

  if (!fullName) return

  await supabase.auth.updateUser({
    data: { full_name: fullName, name: fullName },
  })

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
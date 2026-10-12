'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'

export async function addFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || 'hijo'
  const type = (formData.get('type') as string) || 'person'

  if (!name || name.trim() === '') {
    return { error: 'El nombre es obligatorio' }
  }

  const { error } = await supabase.from('family_members').insert({
    family_id: familyId,
    name: name.trim(),
    role,
    type,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/ajustes')
  revalidatePath('/')
  return { success: true }
}

export async function deleteFamilyMember(memberId: string) {
  const { supabase, familyId } = await getContext()

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('id', memberId)
    .eq('family_id', familyId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/ajustes')
  revalidatePath('/')
  return { success: true }
}
'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'

export async function addFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()

  const name = formData.get('name') as string
  const role = (formData.get('role') as string) || 'hijo'
  const type = (formData.get('type') as string) || 'person'

  if (!name || name.trim() === '') {
    return
  }

  await supabase.from('family_members').insert({
    family_id: familyId,
    name: name.trim(),
    role,
    type,
  })

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
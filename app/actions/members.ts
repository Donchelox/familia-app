'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'

export async function addFamilyMember(formData: FormData) {
  const { supabase, familyId } = await getContext()

  const name = (formData.get('name') as string)?.trim()
  const role = (formData.get('role') as string) || 'hijo'
  const email = (formData.get('email') as string)?.trim() || null

  if (!name) return

  // Inferencia automática: mascota -> 'pet', el resto -> 'person'
  const type = role === 'mascota' ? 'pet' : 'person'

  await supabase.from('family_members').insert({
    family_id: familyId,
    name,
    role,
    type,
    // Si la tabla no tiene la columna email, puedes omitirla o crearla
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

export async function signOut() {
  const { supabase } = await getContext()
  await supabase.auth.signOut()
}
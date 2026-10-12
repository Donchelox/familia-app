'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'

export async function addShoppingItem(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const name = (formData.get('name') as string)?.trim()
  const list = (formData.get('list') as string) || 'super'

  if (!name) return

  await supabase.from('shopping_items').insert({
    family_id: familyId,
    name,
    list,
    done: false,
  })

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

export async function updateShoppingItem(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()

  if (!id || !name) return

  await supabase
    .from('shopping_items')
    .update({ name })
    .eq('id', id)
    .eq('family_id', familyId)

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

export async function toggleShoppingItem(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const id = formData.get('id') as string
  const doneVal = formData.get('done')
  const done = doneVal === 'true'

  if (!id) return

  await supabase
    .from('shopping_items')
    .update({ done: !done })
    .eq('id', id)
    .eq('family_id', familyId)

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

export async function deleteShoppingItem(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const id = formData.get('id') as string

  if (!id) return

  await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .eq('family_id', familyId)

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

export async function clearBought(formData: FormData) {
  const { supabase, familyId } = await getContext()
  const list = (formData.get('list') as string) || 'super'

  await supabase
    .from('shopping_items')
    .delete()
    .eq('family_id', familyId)
    .eq('list', list)
    .eq('done', true)

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// Aliases para compatibilidad
export const addItems = addShoppingItem
export const toggleItem = toggleShoppingItem
export const deleteItem = deleteShoppingItem
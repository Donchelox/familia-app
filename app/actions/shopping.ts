'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'
import { recordActivity } from '@/lib/audit'

// Helper para obtener el nombre del usuario activo
async function getActorName(supabase: any, user: any, familyId: string): Promise<string> {
  if (!user) return 'Familiar'

  const { data: member } = await supabase
    .from('family_members')
    .select('name')
    .eq('family_id', familyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (member?.name) return member.name

  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    (user.email ? user.email.split('@')[0] : 'Familiar')
  )
}

// 1. AÑADIR ÍTEM A LA LISTA (Súper o Feria vía FormData)
export async function addShoppingItem(formData: FormData) {
  const { supabase, familyId } = await getContext()

  const name = (formData.get('name') as string)?.trim()
  const list = (formData.get('list') as string)?.trim() || 'super'
  const category = (formData.get('category') as string)?.trim() || null
  const quantity = (formData.get('quantity') as string)?.trim() || null

  if (!name) return

  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  const payload = {
    family_id: familyId,
    name,
    list: list.toLowerCase(),
    category,
    quantity,
    done: false,
  }

  const { data: newItem, error } = await supabase
    .from('shopping_items')
    .insert(payload)
    .select('id, name, list')
    .single()

  if (!error && newItem) {
    const listLabel = newItem.list === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      entityId: newItem.id,
      action: 'create',
      title: `Agregado a ${listLabel}: ${newItem.name}${quantity ? ` (${quantity})` : ''}`,
      scheduledAt: null,
      details: { list: newItem.list, quantity, category },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// 2. MARCAR / DESMARCAR COMPRADO (TOGGLE)
export async function toggleShoppingItem(id: string, currentDone: boolean) {
  const { supabase, familyId } = await getContext()
  const nextDone = !currentDone

  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  const { data: item } = await supabase
    .from('shopping_items')
    .select('name, list')
    .eq('id', id)
    .eq('family_id', familyId)
    .single()

  const { error } = await supabase
    .from('shopping_items')
    .update({ done: nextDone })
    .eq('id', id)
    .eq('family_id', familyId)

  if (!error && item) {
    const listLabel = item.list === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      entityId: id,
      action: 'toggle',
      title: `${nextDone ? 'Comprado' : 'Pendiente'} en ${listLabel}: ${item.name}`,
      scheduledAt: null,
      details: { list: item.list, done: nextDone },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// 3. ELIMINAR UN ÍTEM ESPECÍFICO
export async function deleteShoppingItem(id: string) {
  const { supabase, familyId } = await getContext()

  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  const { data: item } = await supabase
    .from('shopping_items')
    .select('name, list')
    .eq('id', id)
    .eq('family_id', familyId)
    .single()

  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', id)
    .eq('family_id', familyId)

  if (!error && item) {
    const listLabel = item.list === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      entityId: id,
      action: 'delete',
      title: `Eliminado de ${listLabel}: ${item.name}`,
      scheduledAt: null,
      details: { list: item.list },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// 4. LIMPIAR TODOS LOS COMPRADOS (CLEAR COMPLETED)
export async function clearCompletedShopping(listType: 'super' | 'feria') {
  const { supabase, familyId } = await getContext()

  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  const { data: completedItems } = await supabase
    .from('shopping_items')
    .select('id, name')
    .eq('family_id', familyId)
    .eq('list', listType)
    .eq('done', true)

  const count = completedItems?.length || 0

  if (count > 0) {
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('family_id', familyId)
      .eq('list', listType)
      .eq('done', true)

    if (!error) {
      const listLabel = listType === 'feria' ? 'Feria' : 'Supermercado'
      await recordActivity(supabase, {
        familyId,
        actorName,
        entity: 'shopping',
        action: 'delete',
        title: `Vaciado de comprados en ${listLabel} (${count} ítems removidos)`,
        scheduledAt: null,
        details: { list: listType, count },
      })
    }
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// 5. AÑADIR MÚLTIPLES ÍTEMS (Requerido por AddShoppingSheet)
export async function addItems(list: 'super' | 'feria', items: string[]) {
  const { supabase, familyId } = await getContext()

  const validItems = items.map((i) => i.trim()).filter(Boolean)
  if (validItems.length === 0) return

  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  const rows = validItems.map((name) => ({
    family_id: familyId,
    name,
    list: list.toLowerCase(),
    done: false,
  }))

  const { error } = await supabase.from('shopping_items').insert(rows)

  if (!error) {
    const listLabel = list === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      action: 'create',
      title: `Añadidos a ${listLabel}: ${validItems.join(', ')}`,
      scheduledAt: null,
      details: { list, count: validItems.length },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// Alias de conveniencia
export const addItem = addShoppingItem
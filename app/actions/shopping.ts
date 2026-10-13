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

// 2. ACTUALIZAR ÍTEM (Nombre, cantidad o categoría)
export async function updateShoppingItem(
  arg1: string | FormData,
  arg2?: { name?: string; quantity?: string | null; category?: string | null }
) {
  const { supabase, familyId } = await getContext()

  let id = ''
  const updates: Record<string, any> = {}

  if (arg1 instanceof FormData) {
    id = (arg1.get('id') as string)?.trim()
    const name = (arg1.get('name') as string)?.trim()
    const quantity = (arg1.get('quantity') as string)?.trim()
    const category = (arg1.get('category') as string)?.trim()

    if (name) updates.name = name
    if (quantity !== undefined) updates.quantity = quantity || null
    if (category !== undefined) updates.category = category || null
  } else {
    id = arg1
    if (arg2) {
      if (arg2.name !== undefined) updates.name = arg2.name.trim()
      if (arg2.quantity !== undefined) updates.quantity = arg2.quantity
      if (arg2.category !== undefined) updates.category = arg2.category
    }
  }

  if (!id || Object.keys(updates).length === 0) return

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
    .update(updates)
    .eq('id', id)
    .eq('family_id', familyId)

  if (!error && item) {
    const listLabel = item.list === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      entityId: id,
      action: 'update',
      title: `Actualizado en ${listLabel}: ${updates.name || item.name}`,
      scheduledAt: null,
      details: { list: item.list, ...updates },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// 3. MARCAR / DESMARCAR COMPRADO (TOGGLE)
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

// 4. ELIMINAR UN ÍTEM ESPECÍFICO
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

// 5. LIMPIAR TODOS LOS COMPRADOS (CLEAR COMPLETED)
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

// 6. AÑADIR MÚLTIPLES ÍTEMS (Compatible con AddShoppingSheet)
export async function addItems(
  arg1: 'super' | 'feria' | FormData,
  arg2?: string[]
) {
  const { supabase, familyId } = await getContext()
  const userRes = await supabase.auth.getUser()
  const actorName = await getActorName(supabase, userRes.data?.user, familyId)

  let listType: 'super' | 'feria' = 'super'
  let rawNames: string[] = []

  if (arg1 instanceof FormData) {
    const listVal = (arg1.get('list') as string)?.trim().toLowerCase()
    listType = listVal === 'feria' ? 'feria' : 'super'

    const itemsField =
      (arg1.get('items') as string) || (arg1.get('name') as string) || ''
    rawNames = itemsField
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    listType = arg1
    rawNames = (arg2 || []).map((s) => s.trim()).filter(Boolean)
  }

  if (rawNames.length === 0) return

  const rows = rawNames.map((name) => ({
    family_id: familyId,
    name,
    list: listType,
    done: false,
  }))

  const { error } = await supabase.from('shopping_items').insert(rows)

  if (!error) {
    const listLabel = listType === 'feria' ? 'Feria' : 'Supermercado'
    await recordActivity(supabase, {
      familyId,
      actorName,
      entity: 'shopping',
      action: 'create',
      title: `Añadidos a ${listLabel}: ${rawNames.join(', ')}`,
      scheduledAt: null,
      details: { list: listType, count: rawNames.length },
    })
  }

  revalidatePath('/super')
  revalidatePath('/feria')
  revalidatePath('/')
}

// Alias de compatibilidad
export const addItem = addShoppingItem
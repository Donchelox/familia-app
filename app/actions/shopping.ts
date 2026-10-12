'use server'
import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { str, refresh } from '@/lib/util'

const MOD = { super: 'Supermercado', feria: 'Feria' } as const
const listOf = (fd: FormData) => (str(fd, 'list') === 'feria' ? 'feria' : 'super')

export async function addItems(fd: FormData) {
  const ctx = await getContext()
  const list = listOf(fd)
  const names = str(fd, 'name').split(',').map((s) => s.trim()).filter(Boolean)
  if (!names.length) return
  await ctx.supabase.from('shopping_items').insert(names.map((name) => ({ family_id: ctx.familyId, list, name })))
  for (const n of names) await logActivity(ctx, MOD[list], 'añadido', n)
  refresh()
}
/** Marca como comprado o restaura desde el historial. */
export async function toggleItem(fd: FormData) {
  const ctx = await getContext()
  const { data: it } = await ctx.supabase.from('shopping_items').select('name, list, done').eq('id', str(fd, 'id')).maybeSingle()
  if (!it) return
  await ctx.supabase.from('shopping_items')
    .update({ done: !it.done, done_at: it.done ? null : new Date().toISOString() }).eq('id', str(fd, 'id'))
  await logActivity(ctx, MOD[it.list as 'super' | 'feria'], it.done ? 'restaurado' : 'comprado', it.name)
  refresh()
}
export async function deleteItem(fd: FormData) {
  const ctx = await getContext()
  const { data: it } = await ctx.supabase.from('shopping_items').select('name, list').eq('id', str(fd, 'id')).maybeSingle()
  if (!it) return
  await ctx.supabase.from('shopping_items').delete().eq('id', str(fd, 'id'))
  await logActivity(ctx, MOD[it.list as 'super' | 'feria'], 'eliminado', it.name)
  refresh()
}
export async function clearBought(fd: FormData) {
  const ctx = await getContext()
  const list = listOf(fd)
  await ctx.supabase.from('shopping_items').delete().eq('family_id', ctx.familyId).eq('list', list).eq('done', true)
  await logActivity(ctx, MOD[list], 'historial vaciado')
  refresh()
}

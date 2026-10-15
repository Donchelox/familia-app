'use server'

import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { str, refresh } from '@/lib/util'
import { recordActivity } from '@/lib/audit'

function getActorName(ctx: any): string {
  return (
    ctx.memberName ||
    ctx.user?.user_metadata?.full_name ||
    ctx.user?.user_metadata?.name ||
    (ctx.user?.email ? ctx.user.email.split('@')[0] : 'Familiar')
  )
}

export async function addTodo(fd: FormData) {
  const ctx = await getContext()
  const title = str(fd, 'title')
  if (!title) return

  const { data: inserted } = await ctx.supabase
    .from('todos')
    .insert({ family_id: ctx.familyId, title })
    .select('id')
    .maybeSingle()

  await logActivity(ctx, 'Tareas', 'añadida', title)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'todo',
    entityId: inserted?.id,
    action: 'create',
    title: title,
    scheduledAt: 'Sin fecha límite',
    details: { title },
  })

  refresh()
}

export async function toggleTodo(fd: FormData) {
  const ctx = await getContext()
  const id = str(fd, 'id')
  const { data: t } = await ctx.supabase
    .from('todos')
    .select('title, done')
    .eq('id', id)
    .maybeSingle()

  if (!t) return

  const nextDone = !t.done
  await ctx.supabase
    .from('todos')
    .update({ done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
    .eq('id', id)

  await logActivity(ctx, 'Tareas', t.done ? 'restaurada' : 'completada', t.title)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'todo',
    entityId: id,
    action: 'toggle',
    title: `${nextDone ? 'Tarea completada' : 'Tarea desmarcada'}: ${t.title}`,
    scheduledAt: null,
    details: { done: nextDone },
  })

  refresh()
}

export async function deleteTodo(fd: FormData) {
  const ctx = await getContext()
  const id = str(fd, 'id')
  const { data: t } = await ctx.supabase
    .from('todos')
    .select('title')
    .eq('id', id)
    .maybeSingle()

  if (!t) return

  await ctx.supabase.from('todos').delete().eq('id', id)
  await logActivity(ctx, 'Tareas', 'eliminada', t.title)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'todo',
    entityId: id,
    action: 'delete',
    title: `Tarea eliminada: ${t.title}`,
  })

  refresh()
}

export async function clearTodos() {
  const ctx = await getContext()
  await ctx.supabase.from('todos').delete().eq('family_id', ctx.familyId).eq('done', true)
  await logActivity(ctx, 'Tareas', 'historial vaciado')
  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'todo',
    action: 'delete',
    title: 'Vaciado de tareas completadas',
  })
  refresh()
}
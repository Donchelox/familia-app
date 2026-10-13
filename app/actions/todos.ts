'use server'
import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { str, refresh } from '@/lib/util'
import { recordActivity } from '@/lib/audit'

export async function addTodo(fd: FormData) {
  const ctx = await getContext()
  const title = str(fd, 'title')
  if (!title) return
  await ctx.supabase.from('todos').insert({ family_id: ctx.familyId, title })
  await logActivity(ctx, 'Tareas', 'añadida', title)
  refresh()
}
export async function toggleTodo(fd: FormData) {
  const ctx = await getContext()
  const { data: t } = await ctx.supabase.from('todos').select('title, done').eq('id', str(fd, 'id')).maybeSingle()
  if (!t) return
  await ctx.supabase.from('todos')
    .update({ done: !t.done, done_at: t.done ? null : new Date().toISOString() }).eq('id', str(fd, 'id'))
  await logActivity(ctx, 'Tareas', t.done ? 'restaurada' : 'completada', t.title)
  refresh()
}
export async function deleteTodo(fd: FormData) {
  const ctx = await getContext()
  const { data: t } = await ctx.supabase.from('todos').select('title').eq('id', str(fd, 'id')).maybeSingle()
  if (!t) return
  await ctx.supabase.from('todos').delete().eq('id', str(fd, 'id'))
  await logActivity(ctx, 'Tareas', 'eliminada', t.title)
  refresh()
}
export async function clearTodos() {
  const ctx = await getContext()
  await ctx.supabase.from('todos').delete().eq('family_id', ctx.familyId).eq('done', true)
  await logActivity(ctx, 'Tareas', 'historial vaciado')
  refresh()
}
// Al crear una tarea:
await recordActivity(supabase, {
  familyId,
  actorName: assignedTo || userDisplayName,
  entity: 'todo',
  entityId: todoId,
  action: 'create',
  title: title,
  scheduledAt: dueDate ? `Límite: ${dueDate}` : 'Sin fecha límite',
  details: { assigned_to: assignedTo, due_date: dueDate },
})

// Al marcar hecha / pendiente:
await recordActivity(supabase, {
  familyId,
  actorName: userDisplayName,
  entity: 'todo',
  entityId: todoId,
  action: 'toggle',
  title: `Estado cambiado: ${title}`,
  scheduledAt: null,
  details: { done: nextDone },
})

// Al eliminar una tarea:
await recordActivity(supabase, {
  familyId,
  actorName: userDisplayName,
  entity: 'todo',
  entityId: todoId,
  action: 'delete',
  title: `Tarea eliminada: ${title}`,
})

'use server'

import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { refresh, type ActionResult } from '@/lib/util'
import { recordActivity } from '@/lib/audit'
import { AddTodoSchema, TodoIdSchema } from '@/lib/validations/schemas'

function getActorName(ctx: any): string {
  return (
    ctx.memberName ||
    ctx.user?.user_metadata?.full_name ||
    ctx.user?.user_metadata?.name ||
    (ctx.user?.email ? ctx.user.email.split('@')[0] : 'Familiar')
  )
}

export async function addTodo(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso de edición' }

  const parsed = AddTodoSchema.safeParse({
    title: fd.get('title'),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Datos de la tarea inválidos' }
  }

  const { title } = parsed.data

  const { data: inserted, error } = await ctx.supabase
    .from('todos')
    .insert({ family_id: ctx.familyId, title })
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, error: 'No se pudo guardar la tarea' }
  }

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
  return { ok: true }
}

export async function toggleTodo(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso de edición' }

  const parsed = TodoIdSchema.safeParse({ id: fd.get('id') })
  if (!parsed.success) return { ok: false, error: 'ID de tarea inválido' }
  const { id } = parsed.data

  const { data: t } = await ctx.supabase
    .from('todos')
    .select('title, done')
    .eq('id', id)
    .eq('family_id', ctx.familyId)
    .maybeSingle()

  if (!t) return { ok: false, error: 'Tarea no encontrada' }

  const nextDone = !t.done
  const { error } = await ctx.supabase
    .from('todos')
    .update({ done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  if (error) {
    return { ok: false, error: 'No se pudo actualizar la tarea' }
  }

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
  return { ok: true }
}

export async function deleteTodo(fd: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso de edición' }

  const parsed = TodoIdSchema.safeParse({ id: fd.get('id') })
  if (!parsed.success) return { ok: false, error: 'ID de tarea inválido' }
  const { id } = parsed.data

  const { data: t } = await ctx.supabase
    .from('todos')
    .select('title')
    .eq('id', id)
    .eq('family_id', ctx.familyId)
    .maybeSingle()

  if (!t) return { ok: false, error: 'Tarea no encontrada' }

  const { error } = await ctx.supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  if (error) {
    return { ok: false, error: 'No se pudo eliminar la tarea' }
  }

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
  return { ok: true }
}

export async function clearTodos(): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso de edición' }

  const { error } = await ctx.supabase
    .from('todos')
    .delete()
    .eq('family_id', ctx.familyId)
    .eq('done', true)

  if (error) {
    return { ok: false, error: 'No se pudo vaciar el historial de tareas' }
  }

  await logActivity(ctx, 'Tareas', 'historial vaciado')

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'todo',
    action: 'delete',
    title: 'Vaciado de tareas completadas',
  })

  refresh()
  return { ok: true }
}
'use server'

import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { str, refresh } from '@/lib/util'
import { recordActivity } from '@/lib/audit'
import {
  AddTestSchema,
  AddHomeworkSchema,
  AddSchoolBlockSchema,
  UUID_SCHEMA,
  TIME_SCHEMA,
} from '@/lib/validations/schemas'

function getActorName(ctx: any): string {
  return (
    ctx.memberName ||
    ctx.user?.user_metadata?.full_name ||
    ctx.user?.user_metadata?.name ||
    (ctx.user?.email ? ctx.user.email.split('@')[0] : 'Familiar')
  )
}

/* Pruebas y tareas (admin y editores) */
export async function addTest(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  const parsed = AddTestSchema.safeParse({
    subject: fd.get('subject'),
    topic: fd.get('topic') || null,
    date: fd.get('date'),
  })
  if (!parsed.success) return

  const { subject, topic, date: testDate } = parsed.data

  const { data: inserted } = await ctx.supabase
    .from('school_tests')
    .insert({
      family_id: ctx.familyId,
      subject,
      topic,
      test_date: testDate,
    })
    .select('id')
    .maybeSingle()

  await logActivity(ctx, 'Colegio', 'prueba añadida', subject)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_test',
    entityId: inserted?.id,
    action: 'create',
    title: `Evaluación de ${subject}: ${topic || 'Sin temario'}`,
    scheduledAt: `Fecha programada: ${testDate}`,
    details: { subject, topic, test_date: testDate },
  })

  refresh()
}

export async function deleteTest(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  const parsed = UUID_SCHEMA.safeParse(fd.get('id'))
  if (!parsed.success) return
  const id = parsed.data

  const { data: t } = await ctx.supabase
    .from('school_tests')
    .select('subject')
    .eq('id', id)
    .eq('family_id', ctx.familyId)
    .maybeSingle()

  if (!t) return

  await ctx.supabase
    .from('school_tests')
    .delete()
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  await logActivity(ctx, 'Colegio', 'prueba eliminada', t.subject)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_test',
    entityId: id,
    action: 'delete',
    title: `Prueba eliminada: ${t.subject}`,
    details: { subject: t.subject },
  })

  refresh()
}

export async function addHomework(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  const parsed = AddHomeworkSchema.safeParse({
    subject: fd.get('subject'),
    task: fd.get('task'),
    due: fd.get('due'),
  })
  if (!parsed.success) return

  const { subject, task, due } = parsed.data

  const { data: inserted } = await ctx.supabase
    .from('school_homework')
    .insert({
      family_id: ctx.familyId,
      subject,
      task,
      due,
    })
    .select('id')
    .maybeSingle()

  await logActivity(ctx, 'Colegio', 'tarea añadida', `${subject} · ${task}`)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_homework',
    entityId: inserted?.id,
    action: 'create',
    title: `Tarea escolar: ${subject} · ${task}`,
    scheduledAt: due ? `Entrega: ${due}` : null,
    details: { subject, task, due },
  })

  refresh()
}

export async function toggleHomework(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  const parsed = UUID_SCHEMA.safeParse(fd.get('id'))
  if (!parsed.success) return
  const id = parsed.data

  const { data: h } = await ctx.supabase
    .from('school_homework')
    .select('subject, task, done')
    .eq('id', id)
    .eq('family_id', ctx.familyId)
    .maybeSingle()

  if (!h) return

  const nextDone = !h.done
  await ctx.supabase
    .from('school_homework')
    .update({ done: nextDone, done_at: nextDone ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  await logActivity(ctx, 'Colegio', nextDone ? 'tarea hecha' : 'tarea restaurada', `${h.subject} · ${h.task}`)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_homework',
    entityId: id,
    action: 'toggle',
    title: `${nextDone ? 'Tarea escolar completada' : 'Tarea escolar restaurada'}: ${h.subject} · ${h.task}`,
    details: { done: nextDone },
  })

  refresh()
}

export async function deleteHomework(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  const parsed = UUID_SCHEMA.safeParse(fd.get('id'))
  if (!parsed.success) return
  const id = parsed.data

  const { data: h } = await ctx.supabase
    .from('school_homework')
    .select('subject, task')
    .eq('id', id)
    .eq('family_id', ctx.familyId)
    .maybeSingle()

  if (!h) return

  await ctx.supabase
    .from('school_homework')
    .delete()
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  await logActivity(ctx, 'Colegio', 'tarea eliminada', `${h.subject} · ${h.task}`)

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_homework',
    entityId: id,
    action: 'delete',
    title: `Tarea escolar eliminada: ${h.subject} · ${h.task}`,
    details: { subject: h.subject, task: h.task },
  })

  refresh()
}

export async function clearHomework() {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return

  await ctx.supabase
    .from('school_homework')
    .delete()
    .eq('family_id', ctx.familyId)
    .eq('done', true)

  await logActivity(ctx, 'Colegio', 'historial vaciado')

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_homework',
    action: 'delete',
    title: 'Vaciado de tareas escolares completadas',
  })

  refresh()
}

/* Horario de clases (solo administradores; lo exige RLS) */
export async function addBlock(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return

  const parsed = AddSchoolBlockSchema.safeParse({
    day: fd.get('day'),
    start: fd.get('start'),
    length: fd.get('length'),
    subject: fd.get('subject'),
  })
  if (!parsed.success) return

  const { day, start: startBlock, length, subject } = parsed.data

  const { data: inserted } = await ctx.supabase
    .from('school_blocks')
    .insert({
      family_id: ctx.familyId,
      day,
      start_block: startBlock,
      length,
      subject,
    })
    .select('id')
    .maybeSingle()

  await recordActivity(ctx.supabase, {
    familyId: ctx.familyId,
    actorName: getActorName(ctx),
    entity: 'school_schedule',
    entityId: inserted?.id,
    action: 'create',
    title: `Bloque de clase: ${subject}`,
    scheduledAt: `Día ${day}, bloque ${startBlock}`,
    details: { day, startBlock, length, subject },
  })

  refresh()
}

export async function deleteBlock(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return

  const parsed = UUID_SCHEMA.safeParse(fd.get('id'))
  if (!parsed.success) return
  const id = parsed.data

  await ctx.supabase
    .from('school_blocks')
    .delete()
    .eq('family_id', ctx.familyId)
    .eq('id', id)

  refresh()
}

export async function saveSlots(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return

  for (let b = 1; b <= 12; b++) {
    const rawVal = str(fd, `slot_${b}`)
    if (rawVal && TIME_SCHEMA.safeParse(rawVal).success) {
      await ctx.supabase.from('school_slots').upsert({ family_id: ctx.familyId, block: b, starts_at: rawVal })
    } else if (!rawVal) {
      await ctx.supabase.from('school_slots').delete().eq('family_id', ctx.familyId).eq('block', b)
    }
  }

  refresh()
}
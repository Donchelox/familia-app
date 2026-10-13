'use server'
import { getContext } from '@/lib/family'
import { logActivity } from '@/lib/log'
import { str, refresh } from '@/lib/util'
import { recordActivity } from '@/lib/audit'

/* Pruebas y tareas (admin y editores) */
export async function addTest(fd: FormData) {
  const ctx = await getContext()
  const subject = str(fd, 'subject')
  await ctx.supabase.from('school_tests').insert({
    family_id: ctx.familyId, subject, topic: str(fd, 'topic') || null, test_date: str(fd, 'date'),
  })
  await logActivity(ctx, 'Colegio', 'prueba añadida', subject)
  refresh()
}
export async function deleteTest(fd: FormData) {
  const ctx = await getContext()
  const { data: t } = await ctx.supabase.from('school_tests').select('subject').eq('id', str(fd, 'id')).maybeSingle()
  if (!t) return
  await ctx.supabase.from('school_tests').delete().eq('id', str(fd, 'id'))
  await logActivity(ctx, 'Colegio', 'prueba eliminada', t.subject)
  refresh()
}
export async function addHomework(fd: FormData) {
  const ctx = await getContext()
  const subject = str(fd, 'subject'), task = str(fd, 'task')
  await ctx.supabase.from('school_homework').insert({ family_id: ctx.familyId, subject, task, due: str(fd, 'due') })
  await logActivity(ctx, 'Colegio', 'tarea añadida', `${subject} · ${task}`)
  refresh()
}
export async function toggleHomework(fd: FormData) {
  const ctx = await getContext()
  const { data: h } = await ctx.supabase.from('school_homework').select('subject, task, done').eq('id', str(fd, 'id')).maybeSingle()
  if (!h) return
  await ctx.supabase.from('school_homework')
    .update({ done: !h.done, done_at: h.done ? null : new Date().toISOString() }).eq('id', str(fd, 'id'))
  await logActivity(ctx, 'Colegio', h.done ? 'tarea restaurada' : 'tarea hecha', `${h.subject} · ${h.task}`)
  refresh()
}
export async function deleteHomework(fd: FormData) {
  const ctx = await getContext()
  const { data: h } = await ctx.supabase.from('school_homework').select('subject, task').eq('id', str(fd, 'id')).maybeSingle()
  if (!h) return
  await ctx.supabase.from('school_homework').delete().eq('id', str(fd, 'id'))
  await logActivity(ctx, 'Colegio', 'tarea eliminada', `${h.subject} · ${h.task}`)
  refresh()
}
export async function clearHomework() {
  const ctx = await getContext()
  await ctx.supabase.from('school_homework').delete().eq('family_id', ctx.familyId).eq('done', true)
  await logActivity(ctx, 'Colegio', 'historial vaciado')
  refresh()
}

/* Horario de clases (solo administradores; lo exige RLS) */
export async function addBlock(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return
  await ctx.supabase.from('school_blocks').insert({
    family_id: ctx.familyId, day: Number(str(fd, 'day')), start_block: Number(str(fd, 'start')),
    length: Number(str(fd, 'length')) === 2 ? 2 : 1, subject: str(fd, 'subject'),
  })
  refresh()
}
export async function deleteBlock(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return
  await ctx.supabase.from('school_blocks').delete().eq('family_id', ctx.familyId).eq('id', str(fd, 'id'))
  refresh()
}
export async function saveSlots(fd: FormData) {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return
  for (let b = 1; b <= 12; b++) {
    const v = str(fd, `slot_${b}`)
    if (v) await ctx.supabase.from('school_slots').upsert({ family_id: ctx.familyId, block: b, starts_at: v })
    else await ctx.supabase.from('school_slots').delete().eq('family_id', ctx.familyId).eq('block', b)
  }
  refresh()
}

// Al crear o editar una prueba:
await recordActivity(supabase, {
  familyId,
  actorName: userDisplayName,
  entity: 'school_test',
  entityId: testId,
  action: isEditing ? 'update' : 'create',
  title: `Evaluación de ${subject}: ${topic || 'Sin temario'}`,
  scheduledAt: `Fecha programada: ${testDate}`,
  details: { subject, topic, test_date: testDate },
})

// Al agregar o modificar un bloque de horario escolar:
await recordActivity(supabase, {
  familyId,
  actorName: userDisplayName,
  entity: 'school_schedule',
  entityId: scheduleId,
  action: 'create',
  title: `Bloque de clase: ${subject}`,
  scheduledAt: `${day} de ${timeStart} a ${timeEnd}`,
  details: { day, subject, timeStart, timeEnd, teacher: teacherInitials },
})

// Al marcar o crear tareas escolares (homework):
await recordActivity(supabase, {
  familyId,
  actorName: userDisplayName,
  entity: 'school_homework',
  entityId: hwId,
  action: isDone ? 'toggle' : 'create',
  title: `Tarea escolar: ${title}`,
  scheduledAt: dueDate ? `Entrega: ${dueDate}` : null,
  details: { done: isDone },
})

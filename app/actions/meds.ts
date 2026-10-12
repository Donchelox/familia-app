'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'
import { todayStr } from '@/lib/dates'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const field = (fd: FormData, k: string, max = 200) =>
  String(fd.get(k) ?? '').trim().slice(0, max)

const timesOf = (fd: FormData) => {
  const t = [...new Set(fd.getAll('times').map((v) => String(v).trim()).filter((v) => TIME_RE.test(v)))].sort()
  return t.length ? t : ['08:00']
}

const refreshMeds = () => {
  revalidatePath('/meds')
  revalidatePath('/')
}

// getContext() queda FUERA de los try/catch: internamente usa redirect(), que no debe atraparse.

export async function addMedicationAction(formData: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const name = field(formData, 'name')
  if (!name) return { ok: false, error: 'Falta el nombre' }
  const dose = field(formData, 'dose')
  const person = field(formData, 'person') || 'Toda la familia'

  const { error } = await ctx.supabase.from('medications').insert({
    family_id: ctx.familyId,
    name,
    dose: dose || null,
    times: timesOf(formData),
    person,
  })
  if (error) {
    console.error('addMedicationAction:', error)
    return { ok: false, error: 'No se pudo guardar el medicamento' }
  }
  refreshMeds()
  return { ok: true }
}

export async function updateMedicationAction(formData: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const id = field(formData, 'id')
  const name = field(formData, 'name')
  if (!UUID_RE.test(id) || !name) return { ok: false, error: 'Datos incompletos' }
  const dose = field(formData, 'dose')
  const person = field(formData, 'person') || 'Toda la familia'

  const { error } = await ctx.supabase
    .from('medications')
    .update({ name, dose: dose || null, times: timesOf(formData), person })
    .eq('id', id)
    .eq('family_id', ctx.familyId)
  if (error) {
    console.error('updateMedicationAction:', error)
    return { ok: false, error: 'No se pudo actualizar el medicamento' }
  }
  refreshMeds()
  return { ok: true }
}

export async function deleteMedicationAction(formData: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const id = field(formData, 'id')
  if (!UUID_RE.test(id)) return { ok: false }

  const { error } = await ctx.supabase
    .from('medications')
    .delete()
    .eq('id', id)
    .eq('family_id', ctx.familyId)
  if (error) {
    console.error('deleteMedicationAction:', error)
    return { ok: false, error: 'No se pudo eliminar el medicamento' }
  }
  refreshMeds()
  return { ok: true }
}

export async function toggleDoseAction(formData: FormData) {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const medicationId = field(formData, 'medicationId')
  const scheduledTime = field(formData, 'scheduledTime', 5)
  const isTaken = formData.get('isTaken') === 'true'
  if (!UUID_RE.test(medicationId) || !TIME_RE.test(scheduledTime)) return { ok: false }

  // La fecha la define el servidor (hora de Chile), no el cliente
  const day = todayStr()

  // El medicamento debe pertenecer a mi familia
  const { data: med } = await ctx.supabase
    .from('medications')
    .select('id')
    .eq('id', medicationId)
    .eq('family_id', ctx.familyId)
    .maybeSingle()
  if (!med) return { ok: false }

  if (isTaken) {
    const { error } = await ctx.supabase
      .from('dose_logs')
      .delete()
      .eq('family_id', ctx.familyId)
      .eq('medication_id', medicationId)
      .eq('day', day)
      .eq('time', scheduledTime)
    if (error) {
      console.error('toggleDoseAction delete:', error)
      return { ok: false, error: 'No se pudo desmarcar la dosis' }
    }
  } else {
    const { error } = await ctx.supabase
      .from('dose_logs')
      .upsert(
        { family_id: ctx.familyId, medication_id: medicationId, day, time: scheduledTime },
        { onConflict: 'medication_id,day,time', ignoreDuplicates: true }
      )
    if (error) {
      console.error('toggleDoseAction insert:', error)
      return { ok: false, error: 'No se pudo marcar la dosis' }
    }
  }

  refreshMeds()
  return { ok: true }
}
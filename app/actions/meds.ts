'use server'

import { revalidatePath } from 'next/cache'
import { getContext } from '@/lib/family'
import { todayStr } from '@/lib/dates'
import type { ActionResult } from '@/lib/util'
import {
  MedicationSchema,
  UpdateMedicationSchema,
  ToggleDoseSchema,
  UUID_SCHEMA,
} from '@/lib/validations/schemas'

const refreshMeds = () => {
  revalidatePath('/meds')
  revalidatePath('/')
}

// getContext() queda FUERA de los try/catch: internamente usa redirect(), que no debe atraparse.

export async function addMedicationAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const timesRaw = formData.getAll('times').map((v) => String(v).trim()).filter(Boolean)
  const times = timesRaw.length > 0 ? [...new Set(timesRaw)].sort() : ['08:00']

  const parsed = MedicationSchema.safeParse({
    name: formData.get('name'),
    dose: formData.get('dose') || null,
    person: formData.get('person') || 'Toda la familia',
    times,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Datos del medicamento inválidos' }
  }

  const { name, dose, person, times: validTimes } = parsed.data

  const { error } = await ctx.supabase.from('medications').insert({
    family_id: ctx.familyId,
    name,
    dose: dose || null,
    times: validTimes,
    person,
  })
  if (error) {
    console.error('addMedicationAction:', error)
    return { ok: false, error: 'No se pudo guardar el medicamento' }
  }
  refreshMeds()
  return { ok: true }
}

export async function updateMedicationAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const timesRaw = formData.getAll('times').map((v) => String(v).trim()).filter(Boolean)
  const times = timesRaw.length > 0 ? [...new Set(timesRaw)].sort() : ['08:00']

  const parsed = UpdateMedicationSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    dose: formData.get('dose') || null,
    person: formData.get('person') || 'Toda la familia',
    times,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Datos incompletos o inválidos' }
  }

  const { id, name, dose, person, times: validTimes } = parsed.data

  const { error } = await ctx.supabase
    .from('medications')
    .update({ name, dose: dose || null, times: validTimes, person })
    .eq('id', id)
    .eq('family_id', ctx.familyId)

  if (error) {
    console.error('updateMedicationAction:', error)
    return { ok: false, error: 'No se pudo actualizar el medicamento' }
  }
  refreshMeds()
  return { ok: true }
}

export async function deleteMedicationAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const parsed = UUID_SCHEMA.safeParse(formData.get('id'))
  if (!parsed.success) return { ok: false, error: 'ID de medicamento inválido' }
  const id = parsed.data

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

export async function toggleDoseAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getContext()
  if (ctx.role === 'viewer') return { ok: false, error: 'Sin permiso' }

  const parsed = ToggleDoseSchema.safeParse({
    medicationId: formData.get('medicationId'),
    scheduledTime: String(formData.get('scheduledTime') ?? '').slice(0, 5),
    isTaken: formData.get('isTaken') === 'true',
  })

  if (!parsed.success) return { ok: false, error: 'Datos de dosis inválidos' }
  const { medicationId, scheduledTime, isTaken } = parsed.data

  // La fecha la define el servidor (hora de Chile), no el cliente
  const day = todayStr()

  // El medicamento debe pertenecer a mi familia
  const { data: med } = await ctx.supabase
    .from('medications')
    .select('id')
    .eq('id', medicationId)
    .eq('family_id', ctx.familyId)
    .maybeSingle()
  if (!med) return { ok: false, error: 'Medicamento no encontrado' }

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
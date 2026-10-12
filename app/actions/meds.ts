'use server'

import { getContext } from '@/lib/family'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function addMedicationAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const name = String(formData.get('name') || '').trim()
    const dose = String(formData.get('dose') || '').trim()
    const memberId = String(formData.get('memberId') || '').trim()
    
    // Obtener todos los campos de hora enviados por el formulario
    const timesRaw = formData.getAll('times').map(t => String(t).trim()).filter(Boolean)

    if (!name) return { ok: false, error: 'Falta el nombre' }

    let assignedName: string | null = null
    if (memberId) {
      const { data: member } = await supabase
        .from('members')
        .select('name')
        .eq('id', memberId)
        .single()
      assignedName = member?.name || null
    }

    const finalTimes = timesRaw.length > 0 ? timesRaw : ['08:00']

    const payload: any = {
      family_id: ctx.familyId,
      name,
      dose: dose || null,
      times: finalTimes,
      assigned_to: assignedName,
      active: true,
    }

    if (memberId) {
      payload.member_id = memberId
    }

    const { error } = await supabase.from('medications').insert(payload)
    if (error) {
      console.error('Error al insertar medicamento:', error)
      return { ok: false, error: error.message }
    }

    revalidatePath('/meds')
    revalidatePath('/')
    return { ok: true }
  } catch (err: any) {
    console.error('Excepción addMedicationAction:', err)
    return { ok: false, error: err.message }
  }
}

export async function updateMedicationAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const id = String(formData.get('id') || '')
    const name = String(formData.get('name') || '').trim()
    const dose = String(formData.get('dose') || '').trim()
    const memberId = String(formData.get('memberId') || '').trim()
    const timesRaw = formData.getAll('times').map(t => String(t).trim()).filter(Boolean)

    if (!id || !name) return { ok: false, error: 'Datos incompletos' }

    let assignedName: string | null = null
    if (memberId) {
      const { data: member } = await supabase
        .from('members')
        .select('name')
        .eq('id', memberId)
        .single()
      assignedName = member?.name || null
    }

    const finalTimes = timesRaw.length > 0 ? timesRaw : ['08:00']

    const updatePayload: any = {
      name,
      dose: dose || null,
      assigned_to: assignedName,
      times: finalTimes,
    }

    if (memberId) {
      updatePayload.member_id = memberId
    }

    const { error } = await supabase
      .from('medications')
      .update(updatePayload)
      .eq('id', id)
      .eq('family_id', ctx.familyId)

    if (error) {
      console.error('Error al actualizar medicamento:', error)
      return { ok: false, error: error.message }
    }

    revalidatePath('/meds')
    revalidatePath('/')
    return { ok: true }
  } catch (err: any) {
    console.error('Excepción updateMedicationAction:', err)
    return { ok: false, error: err.message }
  }
}

export async function deleteMedicationAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const id = String(formData.get('id') || '')
    if (!id) return { ok: false }

    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('family_id', ctx.familyId)

    if (error) {
      console.error('Error deleteMedicationAction:', error)
      return { ok: false, error: error.message }
    }

    revalidatePath('/meds')
    revalidatePath('/')
    return { ok: true }
  } catch (err: any) {
    console.error('Excepción deleteMedicationAction:', err)
    return { ok: false, error: err.message }
  }
}

export async function toggleDoseAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const medicationId = String(formData.get('medicationId') || '')
    const scheduledTime = String(formData.get('scheduledTime') || '')
    const date = String(formData.get('date') || '')
    const isTaken = formData.get('isTaken') === 'true'

    if (!medicationId || !date) return { ok: false }

    if (isTaken) {
      await supabase
        .from('dose_logs')
        .delete()
        .eq('family_id', ctx.familyId)
        .eq('medication_id', medicationId)
        .eq('date', date)
        .eq('scheduled_time', scheduledTime)
    } else {
      const { data: medData } = await supabase
        .from('medications')
        .select('member_id')
        .eq('id', medicationId)
        .single()

      let memberId = medData?.member_id

      if (!memberId) {
        const { data: members } = await supabase
          .from('members')
          .select('id')
          .eq('family_id', ctx.familyId)
          .limit(1)

        memberId = members?.[0]?.id
      }

      const logPayload: any = {
        family_id: ctx.familyId,
        medication_id: medicationId,
        scheduled_time: scheduledTime,
        date,
        taken_at: new Date().toISOString(),
      }

      if (memberId) {
        logPayload.member_id = memberId
      }

      const { error } = await supabase.from('dose_logs').insert(logPayload)
      if (error) {
        console.error('Error al insertar dose_log:', error)
        return { ok: false, error: error.message }
      }
    }

    revalidatePath('/meds')
    revalidatePath('/')
    return { ok: true }
  } catch (err: any) {
    console.error('Excepción toggleDoseAction:', err)
    return { ok: false, error: err.message }
  }
}
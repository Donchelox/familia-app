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
    const assignedTo = String(formData.get('assignedTo') || '').trim()
    const timesRaw = String(formData.get('times') || '').trim()

    console.log('[DEBUG addMedicationAction] Recibido:', { name, dose, assignedTo, timesRaw, familyId: ctx.familyId })

    if (!name) {
      console.warn('[DEBUG addMedicationAction] Falta el nombre del medicamento.')
      return
    }

    // Obtener el primer miembro de la familia por si la tabla exige member_id no nulo
    const { data: members, error: memErr } = await supabase
      .from('members')
      .select('id, name')
      .eq('family_id', ctx.familyId)
      .limit(1)

    if (memErr) {
      console.error('[DEBUG addMedicationAction] Error consultando miembros:', memErr)
    }

    const defaultMemberId = members && members.length > 0 ? members[0].id : null

    const times = timesRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const finalTimes = times.length > 0 ? times : ['08:00']

    const payload: any = {
      family_id: ctx.familyId,
      name,
      dose: dose || null,
      times: finalTimes,
      assigned_to: assignedTo || (members && members.length > 0 ? members[0].name : null),
      active: true,
    }

    if (defaultMemberId) {
      payload.member_id = defaultMemberId
    }

    console.log('[DEBUG addMedicationAction] Insertando payload:', payload)

    const { data, error } = await supabase.from('medications').insert(payload).select()

    if (error) {
      console.error('[DEBUG addMedicationAction] ERROR DE SUPABASE AL INSERTAR:', error)
    } else {
      console.log('[DEBUG addMedicationAction] INSERCIÓN EXITOSA:', data)
    }

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('[DEBUG addMedicationAction] EXCEPCIÓN INESPERADA:', err)
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

    if (!medicationId || !date) return

    if (isTaken) {
      await supabase
        .from('dose_logs')
        .delete()
        .eq('family_id', ctx.familyId)
        .eq('medication_id', medicationId)
        .eq('date', date)
        .eq('scheduled_time', scheduledTime)
    } else {
      await supabase.from('dose_logs').insert({
        family_id: ctx.familyId,
        medication_id: medicationId,
        scheduled_time: scheduledTime,
        date,
        taken_at: new Date().toISOString(),
      })
    }

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('[DEBUG toggleDoseAction] Error:', err)
  }
}
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

    if (!name) return

    const { data: members } = await supabase
      .from('members')
      .select('id, name')
      .eq('family_id', ctx.familyId)
      .limit(1)

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

    await supabase.from('medications').insert(payload)

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('Error addMedicationAction:', err)
  }
}

export async function updateMedicationAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const id = String(formData.get('id') || '')
    const name = String(formData.get('name') || '').trim()
    const dose = String(formData.get('dose') || '').trim()
    const assignedTo = String(formData.get('assignedTo') || '').trim()
    const timesRaw = String(formData.get('times') || '').trim()

    if (!id || !name) return

    const times = timesRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const finalTimes = times.length > 0 ? times : ['08:00']

    await supabase
      .from('medications')
      .update({
        name,
        dose: dose || null,
        assigned_to: assignedTo || null,
        times: finalTimes,
      })
      .eq('id', id)
      .eq('family_id', ctx.familyId)

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('Error updateMedicationAction:', err)
  }
}

export async function deleteMedicationAction(formData: FormData) {
  try {
    const ctx = await getContext()
    const supabase = await getSupabase()

    const id = String(formData.get('id') || '')
    if (!id) return

    await supabase
      .from('medications')
      .delete()
      .eq('id', id)
      .eq('family_id', ctx.familyId)

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('Error deleteMedicationAction:', err)
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
      // Si ya está marcada, desmarcar (borrar log)
      await supabase
        .from('dose_logs')
        .delete()
        .eq('family_id', ctx.familyId)
        .eq('medication_id', medicationId)
        .eq('date', date)
        .eq('scheduled_time', scheduledTime)
    } else {
      // Obtener el member_id asociado a la medicina o al usuario activo
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

      await supabase.from('dose_logs').insert(logPayload)
    }

    revalidatePath('/meds')
    revalidatePath('/')
  } catch (err) {
    console.error('Error toggleDoseAction:', err)
  }
}
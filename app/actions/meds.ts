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
  const ctx = await getContext()
  const supabase = await getSupabase()

  const name = String(formData.get('name') || '').trim()
  const dose = String(formData.get('dose') || '').trim()
  const assignedTo = String(formData.get('assignedTo') || '').trim()
  const timesRaw = String(formData.get('times') || '').trim()

  if (!name) return

  const times = timesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const finalTimes = times.length > 0 ? times : ['08:00']

  await supabase.from('medications').insert({
    family_id: ctx.familyId,
    name,
    dose: dose || null,
    times: finalTimes,
    assigned_to: assignedTo || null,
    active: true,
  })

  revalidatePath('/meds')
  revalidatePath('/')
}

export async function toggleDoseAction(formData: FormData) {
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
}
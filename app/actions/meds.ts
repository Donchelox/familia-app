'use server'
import { getContext } from '@/lib/family'
import { todayStr } from '@/lib/dates'
import { str, refresh } from '@/lib/util'

const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/

/* Los medicamentos no se escriben en activity_log. */
export async function addMedication(fd: FormData) {
  const ctx = await getContext()
  const times = [...new Set(str(fd, 'times').split(',').map((t) => t.trim()).filter(Boolean))]
  if (!times.length || !times.every((t) => TIME.test(t))) return
  await ctx.supabase.from('medications').insert({
    family_id: ctx.familyId, person: str(fd, 'person'), name: str(fd, 'name'), dose: str(fd, 'dose'),
    times: times.map((t) => t.padStart(5, '0')).sort(),
  })
  refresh()
}
export async function deleteMedication(fd: FormData) {
  const ctx = await getContext()
  await ctx.supabase.from('medications').delete().eq('family_id', ctx.familyId).eq('id', str(fd, 'id'))
  refresh()
}
export async function toggleDose(fd: FormData) {
  const ctx = await getContext()
  const key = { medication_id: str(fd, 'id'), day: todayStr(), time: str(fd, 'time') }
  const { data } = await ctx.supabase.from('dose_logs').select('time').match(key).maybeSingle()
  if (data) await ctx.supabase.from('dose_logs').delete().match(key)
  else await ctx.supabase.from('dose_logs').insert({ ...key, family_id: ctx.familyId })
  refresh()
}

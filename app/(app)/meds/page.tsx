import { getContext } from '@/lib/family'
import { todayStr as getToday, nowHHMM } from '@/lib/dates'
import MedsClientView from '@/components/MedsClientView'

export const dynamic = 'force-dynamic'

export default async function MedsPage() {
  const ctx = await getContext()
  const supabase = ctx.supabase

  // 1. Medicamentos
  const { data: rawMeds } = await supabase
    .from('medications')
    .select('id, name, dose, times, person')
    .eq('family_id', ctx.familyId)
    .order('created_at')

  // 2. Miembros de la familia (para el selector "Para quién")
  const { data: rawMembers } = await supabase
    .from('members')
    .select('user_id, display_name, email')
    .eq('family_id', ctx.familyId)
    .order('created_at')
  const members = (rawMembers ?? []).map((m) => ({
    id: m.user_id as string,
    name: (m.display_name || m.email || 'Sin nombre') as string,
  }))

  // 3. Fecha y hora actual en Chile
  const todayStr = getToday()
  const currentHM = nowHHMM()

  // 4. Dosis tomadas hoy
  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('medication_id, time')
    .eq('family_id', ctx.familyId)
    .eq('day', todayStr)
  const takenKeys = (doseLogs ?? []).map((d) => `${d.medication_id}_${d.time}`)

  return (
    <MedsClientView
      familyId={ctx.familyId}
      meds={rawMeds ?? []}
      members={members}
      takenKeys={takenKeys}
      todayStr={todayStr}
      currentHM={currentHM}
    />
  )
}
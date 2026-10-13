import { getContext } from '@/lib/family'
import { todayStr as getToday, nowHHMM } from '@/lib/dates'
import MedsClientView from '@/components/MedsClientView'

export const dynamic = 'force-dynamic'

export default async function MedsPage() {
  const ctx = await getContext()
  const supabase = ctx.supabase

  // 1. Integrantes del hogar (family_members + usuario actual)
  const [membersRes, userRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('id, name')
      .eq('family_id', ctx.familyId)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const user = userRes.data?.user
  const currentUserName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Marcelo Vásquez'

  const membersList: { id: string; name: string }[] = []
  if (currentUserName) {
    membersList.push({ id: user?.id || 'me', name: currentUserName })
  }
  ;(membersRes.data ?? []).forEach((m) => {
    if (m.name && !membersList.some((ex) => ex.name.toLowerCase() === m.name.toLowerCase())) {
      membersList.push({ id: m.id, name: m.name })
    }
  })

  // 2. Fecha y hora actual
  const todayStr = getToday()
  const currentHM = nowHHMM()

  // 3. Medicamentos: se traen todos y se filtran si ya superaron su fecha límite
  const { data: rawMeds } = await supabase
    .from('medications')
    .select('id, name, dose, times, person, frequency, end_date')
    .eq('family_id', ctx.familyId)
    .order('created_at', { ascending: true })

  // Si end_date es NULL o >= hoy, sigue vigente
  const activeMeds = (rawMeds ?? []).filter((med) => {
    if (!med.end_date) return true
    return med.end_date >= todayStr
  })

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
      meds={activeMeds}
      members={membersList}
      takenKeys={takenKeys}
      todayStr={todayStr}
      currentHM={currentHM}
    />
  )
}
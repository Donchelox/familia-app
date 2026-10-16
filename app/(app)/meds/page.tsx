import { getContext } from '@/lib/family'
import { todayStr as getToday, nowHHMM } from '@/lib/dates'
import MedsClientView from '@/components/MedsClientView'

export const dynamic = 'force-dynamic'

export default async function MedsPage() {
  const todayStr = getToday()
  const currentHM = nowHHMM()

  let familyId = ''
  const membersList: { id: string; name: string }[] = []
  let activeMeds: any[] = []
  let takenKeys: string[] = []

  try {
    const ctx = await getContext()
    familyId = ctx.familyId
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
      (user?.email ? user.email.split('@')[0] : '')

    if (currentUserName) {
      membersList.push({ id: user?.id || 'me', name: currentUserName })
    }
    ;(membersRes.data ?? []).forEach((m) => {
      if (m.name && !membersList.some((ex) => ex.name.toLowerCase() === m.name.toLowerCase())) {
        membersList.push({ id: m.id, name: m.name })
      }
    })

    // 2. Medicamentos de Supabase
    const { data: rawMeds } = await supabase
      .from('medications')
      .select('id, name, dose, times, person, frequency, end_date')
      .eq('family_id', ctx.familyId)
      .order('created_at', { ascending: true })

    activeMeds = (rawMeds ?? []).filter((med) => {
      if (!med.end_date) return true
      return med.end_date >= todayStr
    })

    // 3. Dosis tomadas hoy
    const { data: doseLogs } = await supabase
      .from('dose_logs')
      .select('medication_id, time')
      .eq('family_id', ctx.familyId)
      .eq('day', todayStr)

    takenKeys = (doseLogs ?? []).map((d) => `${d.medication_id}_${d.time}`)
  } catch (err) {
    console.debug('[MedsPage] Sin conexión remota al servidor, delegando a persistencia Dexie:', err)
  }

  return (
    <MedsClientView
      familyId={familyId}
      meds={activeMeds}
      members={membersList}
      takenKeys={takenKeys}
      todayStr={todayStr}
      currentHM={currentHM}
    />
  )
}
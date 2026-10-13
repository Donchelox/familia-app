import { getContext } from '@/lib/family'
import AjustesView from '@/components/AjustesView'

export default async function AjustesPage() {
  const { supabase, familyId, familyName } = await getContext()

  const [membersRes, userRes, familyRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
    supabase
      .from('families')
      .select('med_reminders_enabled, morning_summary_enabled')
      .eq('id', familyId)
      .single(),
  ])

  const members = membersRes.data ?? []
  const user = userRes.data?.user
  const userEmail = user?.email || ''
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Usuario'

  // Preferencias iniciales (por defecto activas si no existen en BD)
  const medRemindersEnabled =
    familyRes.data?.med_reminders_enabled ??
    user?.user_metadata?.med_reminders_enabled ??
    true

  const morningSummaryEnabled =
    familyRes.data?.morning_summary_enabled ??
    user?.user_metadata?.morning_summary_enabled ??
    true

  return (
    <AjustesView
      userName={userName}
      userEmail={userEmail}
      familyName={familyName || 'Familia'}
      members={members}
      initialMedReminders={medRemindersEnabled}
      initialMorningSummary={morningSummaryEnabled}
      appVersion="1.0.0"
    />
  )
}
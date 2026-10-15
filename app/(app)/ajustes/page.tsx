import { getContext } from '@/lib/family'
import AjustesHubView from '@/components/AjustesHubView'

export default async function AjustesPage() {
  const { supabase, familyId, familyName, role } = await getContext()

  const [membersRes, userRes, familyRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('id')
      .eq('family_id', familyId),
    supabase.auth.getUser(),
    supabase
      .from('families')
      .select('reminder_push, reminder_email')
      .eq('id', familyId)
      .maybeSingle(),
  ])

  const membersCount = (membersRes.data ?? []).length
  const user = userRes.data?.user
  const userEmail = user?.email || ''
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Usuario'

  // Preferencias iniciales (reminder_push en families)
  const medRemindersEnabled =
    familyRes.data?.reminder_push ??
    user?.user_metadata?.reminder_push ??
    user?.user_metadata?.med_reminders_enabled ??
    true

  return (
    <AjustesHubView
      familyId={familyId}
      userName={userName}
      userEmail={userEmail}
      familyName={familyName}
      membersCount={membersCount}
      isAdmin={role === 'admin'}
      medRemindersEnabled={medRemindersEnabled}
    />
  )
}
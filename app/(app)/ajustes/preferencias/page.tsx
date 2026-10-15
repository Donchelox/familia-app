import { getContext } from '@/lib/family'
import PreferenciasView from '@/components/PreferenciasView'

export default async function PreferenciasPage() {
  const { supabase, familyId } = await getContext()

  const [userRes, familyRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('families')
      .select('reminder_push, reminder_email')
      .eq('id', familyId)
      .maybeSingle(),
  ])

  const user = userRes.data?.user

  // Preferencias iniciales (reminder_push y reminder_email de families)
  const medRemindersEnabled =
    familyRes.data?.reminder_push ??
    user?.user_metadata?.reminder_push ??
    user?.user_metadata?.med_reminders_enabled ??
    true

  const morningSummaryEnabled =
    familyRes.data?.reminder_email ??
    user?.user_metadata?.reminder_email ??
    user?.user_metadata?.morning_summary_enabled ??
    true

  return (
    <PreferenciasView
      familyId={familyId}
      initialMedReminders={medRemindersEnabled}
      initialMorningSummary={morningSummaryEnabled}
    />
  )
}

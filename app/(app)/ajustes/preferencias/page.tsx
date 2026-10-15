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

  const rawInterval = Number(user?.user_metadata?.med_reminder_interval)
  const medReminderInterval = [5, 10, 15, 30].includes(rawInterval) ? rawInterval : 5

  const rawSummaryTime = (user?.user_metadata?.morning_summary_time as string)?.trim()
  const morningSummaryTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rawSummaryTime) ? rawSummaryTime : '07:00'

  // Preferencias modulares: Colegio, Feria, Supermercado
  const schoolRemindersEnabled = user?.user_metadata?.school_reminders_enabled !== false
  const rawSchoolTime = (user?.user_metadata?.school_reminder_time as string)?.trim()
  const schoolReminderTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rawSchoolTime) ? rawSchoolTime : '07:30'

  const feriaRemindersEnabled = user?.user_metadata?.feria_reminders_enabled !== false
  const feriaDays = Array.isArray(user?.user_metadata?.feria_days) && user?.user_metadata?.feria_days.length > 0
    ? user.user_metadata.feria_days
    : ['Jueves', 'Domingo']
  const rawFeriaTime = (user?.user_metadata?.feria_time as string)?.trim()
  const feriaTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rawFeriaTime) ? rawFeriaTime : '07:00'

  const superRemindersEnabled = user?.user_metadata?.super_reminders_enabled !== false
  const rawSuperTime = (user?.user_metadata?.super_time as string)?.trim()
  const superTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(rawSuperTime) ? rawSuperTime : '18:00'

  return (
    <PreferenciasView
      familyId={familyId}
      initialMedReminders={medRemindersEnabled}
      initialMorningSummary={morningSummaryEnabled}
      initialMedReminderInterval={medReminderInterval}
      initialMorningSummaryTime={morningSummaryTime}
      initialSchoolReminders={schoolRemindersEnabled}
      initialSchoolReminderTime={schoolReminderTime}
      initialFeriaReminders={feriaRemindersEnabled}
      initialFeriaDays={feriaDays}
      initialFeriaTime={feriaTime}
      initialSuperReminders={superRemindersEnabled}
      initialSuperTime={superTime}
    />
  )
}

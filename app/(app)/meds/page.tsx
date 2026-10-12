import { getContext } from '@/lib/family'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import MedsClientView from '@/components/MedsClientView'

export const dynamic = 'force-dynamic'

export default async function MedsPage() {
  const ctx = await getContext()
  const cookieStore = await cookies()

  const supabase = createServerClient(
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

  // Obtener medicamentos
  const { data: rawMeds } = await supabase
    .from('medications')
    .select('*')
    .eq('family_id', ctx.familyId)

  // Fecha actual en Chile (YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
  }).format(new Date())

  // Dosis tomadas hoy
  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('medication_id, scheduled_time')
    .eq('family_id', ctx.familyId)
    .eq('date', todayStr)

  const takenKeys = (doseLogs || []).map((d) => `${d.medication_id}_${d.scheduled_time || ''}`)

  // Hora actual en Chile (HH:MM)
  const currentHM = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())

  return (
    <MedsClientView
      familyId={ctx.familyId}
      meds={rawMeds || []}
      takenKeys={takenKeys}
      todayStr={todayStr}
      currentHM={currentHM}
    />
  )
}
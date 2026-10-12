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

  // 1. Obtener medicamentos
  const { data: rawMeds } = await supabase
    .from('medications')
    .select('*')
    .eq('family_id', ctx.familyId)

  // 2. Obtener miembros de la familia
  const { data: members } = await supabase
    .from('members')
    .select('id, name')
    .eq('family_id', ctx.familyId)
    .order('name', { ascending: true })

  // 3. Fecha actual en Chile (YYYY-MM-DD)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
  }).format(new Date())

  // 4. Dosis tomadas hoy
  const { data: doseLogs } = await supabase
    .from('dose_logs')
    .select('medication_id, scheduled_time')
    .eq('family_id', ctx.familyId)
    .eq('date', todayStr)

  const takenKeys = (doseLogs || []).map((d) => `${d.medication_id}_${d.scheduled_time || ''}`)

  // 5. Hora actual en Chile (HH:MM)
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
      members={members || []}
      takenKeys={takenKeys}
      todayStr={todayStr}
      currentHM={currentHM}
    />
  )
}
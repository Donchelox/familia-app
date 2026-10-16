import { getContext } from '@/lib/family'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import HistorialView, { type ActivityLogRow } from '@/components/HistorialView'

export const dynamic = 'force-dynamic'

export default async function HistorialPage() {
  const { familyId, role } = await getContext()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let logs: ActivityLogRow[] = []

  if (url && serviceKey) {
    const admin = createAdminClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data } = await admin
      .from('activity_log')
      .select('id, family_id, user_name, module, action, item, created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(300)

    logs = (data ?? []) as ActivityLogRow[]
  }

  return (
    <HistorialView
      familyId={familyId}
      initialLogs={logs}
      isAdmin={role === 'admin'}
    />
  )
}

import { getContext } from '@/lib/family'
import AjustesView from '@/components/AjustesView'

export default async function AjustesPage() {
  const { supabase, familyId, familyName } = await getContext()

  const [membersRes, userRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    supabase.auth.getUser(),
  ])

  const members = membersRes.data ?? []
  const user = userRes.data?.user
  const userEmail = user?.email || ''
  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    'Usuario'

  return (
    <AjustesView
      userName={userName}
      userEmail={userEmail}
      familyName={familyName || 'Familia'}
      members={members}
    />
  )
}
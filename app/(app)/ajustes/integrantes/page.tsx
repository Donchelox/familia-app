import { getContext } from '@/lib/family'
import IntegrantesView from '@/components/IntegrantesView'

export default async function IntegrantesPage() {
  const { supabase, familyId, role } = await getContext()

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('id, name, role, type')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
      .limit(50),
    supabase
      .from('invites')
      .select('id, email, role, created_at')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const members = membersRes.data ?? []
  const invites = invitesRes.data ?? []

  return (
    <IntegrantesView
      familyId={familyId}
      members={members}
      invites={invites}
      isAdmin={role === 'admin'}
    />
  )
}

import { getContext } from '@/lib/family'
import IntegrantesView from '@/components/IntegrantesView'

export default async function IntegrantesPage() {
  const { supabase, familyId, role } = await getContext()

  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from('family_members')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }),
    supabase
      .from('invites')
      .select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false }),
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

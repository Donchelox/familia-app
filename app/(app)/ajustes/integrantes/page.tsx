import { getContext } from '@/lib/family'
import IntegrantesView from '@/components/IntegrantesView'

export default async function IntegrantesPage() {
  const { supabase, familyId, role, user, name: contextName } = await getContext()

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

  let members = membersRes.data ?? []
  const invites = invitesRes.data ?? []

  // Asegurar que el creador/usuario actual siempre figure en la lista de integrantes
  if (user && !members.some((m) => m.user_id === user.id || m.name?.trim().toLowerCase() === contextName?.trim().toLowerCase())) {
    const creatorMember = {
      id: user.id,
      family_id: familyId,
      name: contextName || 'Administrador',
      role: role === 'admin' ? 'Administrador' : 'Adulto',
      type: 'adult',
      user_id: user.id,
    }
    members = [creatorMember, ...members]
  }

  return (
    <IntegrantesView
      familyId={familyId}
      members={members}
      invites={invites}
      isAdmin={role === 'admin'}
    />
  )
}

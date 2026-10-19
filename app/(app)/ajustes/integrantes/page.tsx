import { getContext } from '@/lib/family'
import IntegrantesView, { type FamilyMember } from '@/components/IntegrantesView'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export default async function IntegrantesPage() {
  const { supabase, familyId, role, user, name: contextName } = await getContext()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminClient =
    serviceKey && url
      ? createAdminClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : supabase

  const [membersRes, invitesRes, houseMembersRes] = await Promise.all([
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
    adminClient
      .from('members')
      .select('user_id, email, display_name')
      .eq('family_id', familyId),
  ])

  let rawMembers = membersRes.data ?? []
  const invites = invitesRes.data ?? []
  const houseMembers = houseMembersRes.data ?? []

  // Vincular correo de members o invites a cada family_member
  let members: FamilyMember[] = rawMembers.map((m) => {
    const matchedUser = houseMembers.find((hm) => hm.user_id && hm.user_id === m.user_id)
    const isCurrentUser = user && (m.user_id === user.id || m.name?.trim().toLowerCase() === contextName?.trim().toLowerCase())
    const currentUserEmail = isCurrentUser ? user.email : undefined
    const matchedInvite = invites.find(
      (inv) =>
        inv.email &&
        (inv.email.toLowerCase().includes(m.name?.toLowerCase().split(' ')[0] || '') ||
          inv.role === m.role)
    )

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      type: m.type,
      user_id: m.user_id,
      is_child: m.is_child,
      is_pet: m.is_pet,
      email: m.email || matchedUser?.email || currentUserEmail || matchedInvite?.email || '',
    }
  })

  // Asegurar que el creador/usuario actual figure si la lista viniera vacía
  if (user && !members.some((m) => m.user_id === user.id || m.name?.trim().toLowerCase() === contextName?.trim().toLowerCase())) {
    const creatorMember: FamilyMember = {
      id: user.id,
      name: contextName || 'Administrador',
      role: role === 'admin' ? 'Administrador' : 'Adulto',
      type: 'adult',
      user_id: user.id,
      email: user.email || '',
    }
    members = [creatorMember, ...members]
  }

  // Deduplicación defensiva en UI por user_id y por nombre
  const seenUsers = new Set<string>()
  const seenNames = new Set<string>()
  const deduplicatedMembers = members.filter((m) => {
    if (m.user_id) {
      if (seenUsers.has(m.user_id)) return false
      seenUsers.add(m.user_id)
    }
    const normalized = m.name?.trim().toLowerCase()
    if (normalized) {
      if (seenNames.has(normalized)) return false
      seenNames.add(normalized)
    }
    return true
  })

  return (
    <IntegrantesView
      familyId={familyId}
      members={deduplicatedMembers}
      invites={invites}
      isAdmin={role === 'admin'}
    />
  )
}

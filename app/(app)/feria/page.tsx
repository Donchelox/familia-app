import { getContext } from '@/lib/family'
import ShoppingView from '@/components/ShoppingView'

export default async function FeriaPage() {
  const { supabase, familyId, role } = await getContext()
  const canEdit = role !== 'viewer'

  const { data } = await supabase
    .from('shopping_items')
    .select('id, name, done')
    .eq('family_id', familyId)
    .eq('list', 'feria')
    .order('created_at', { ascending: false })
    .limit(300)

  const items = (data ?? []).filter((i) => !i.done)
  const bought = (data ?? []).filter((i) => i.done)

  return (
    <ShoppingView
      title="Feria"
      subtitle="Frutas, Verduras y Feria"
      listType="feria"
      items={items}
      boughtItems={bought}
      canEdit={canEdit}
    />
  )
}
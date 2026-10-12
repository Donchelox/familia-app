import { getContext } from '@/lib/family'
import ShoppingView from '@/components/ShoppingView'

export default async function SuperPage() {
  const { supabase, familyId, role } = await getContext()
  const canEdit = role !== 'viewer'

  const { data } = await supabase
    .from('shopping_items')
    .select('id, name, done')
    .eq('family_id', familyId)
    .eq('list', 'super')
    .order('created_at', { ascending: false })
    .limit(300)

  const items = (data ?? []).filter((i) => !i.done)
  const bought = (data ?? []).filter((i) => i.done)

  return (
    <ShoppingView
      title="Compras"
      subtitle="Lista del Supermercado"
      listType="super"
      items={items}
      boughtItems={bought}
      canEdit={canEdit}
    />
  )
}
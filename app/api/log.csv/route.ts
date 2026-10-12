import { getContext } from '@/lib/family'
import { TZ } from '@/lib/dates'

export async function GET() {
  const ctx = await getContext()
  if (ctx.role !== 'admin') return new Response('No autorizado', { status: 403 })
  const { data } = await ctx.supabase
    .from('activity_log').select('created_at, user_name, module, action, item')
    .eq('family_id', ctx.familyId).order('created_at').limit(20000)
  const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const rows = (data ?? []).map((r) => {
    const d = new Date(r.created_at)
    return [
      d.toLocaleDateString('sv', { timeZone: TZ }),
      d.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }),
      r.user_name, r.module, r.action, r.item,
    ].map(q).join(',')
  })
  const csv = '\ufefffecha,hora,usuario,modulo,accion,detalle\n' + rows.join('\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="actividad.csv"',
    },
  })
}

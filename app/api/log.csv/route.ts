import { getApiContext } from '@/lib/family'
import { TZ } from '@/lib/dates'

export const dynamic = 'force-dynamic'

const PAGE = 1000 // Supabase devuelve como máximo 1000 filas por consulta
const MAX_PAGES = 100

// Escapa comillas y neutraliza fórmulas de Excel (=, +, -, @)
const q = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return '"' + s.replace(/"/g, '""') + '"'
}

export async function GET() {
  const ctx = await getApiContext()
  if (!ctx) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (ctx.role !== 'admin') return new Response('No autorizado', { status: 403 })

  const all: { created_at: string; user_name: string | null; module: string; action: string; item: string | null }[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await ctx.supabase
      .from('activity_log')
      .select('created_at, user_name, module, action, item')
      .eq('family_id', ctx.familyId)
      .order('created_at')
      .order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) {
      console.error('log.csv:', error)
      return new Response('Error al generar el archivo', { status: 500 })
    }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }

  const rows = all.map((r) => {
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
import type { Ctx } from '@/lib/family'

/** Registra un cambio en activity_log (los medicamentos no se registran). */
export async function logActivity(ctx: Ctx, module: string, action: string, item = '') {
  await ctx.supabase.from('activity_log').insert({
    family_id: ctx.familyId, user_name: ctx.name, module, action, item,
  })
}

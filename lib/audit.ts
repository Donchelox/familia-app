// lib/audit.ts
import { SupabaseClient } from '@supabase/supabase-js'

export interface AuditPayload {
  familyId: string
  actorName?: string
  entity: 'medication' | 'dose' | 'todo' | 'shopping' | 'school_test' | 'school_homework' | 'school_schedule' | 'member'
  entityId?: string
  action: 'create' | 'update' | 'delete' | 'toggle'
  title: string
  scheduledAt?: string | null // ej: "08:00 hrs", "2026-10-15", "Lunes 08:00 - 09:30"
  details?: Record<string, any>
}

export async function recordActivity(supabase: SupabaseClient, payload: AuditPayload) {
  try {
    const detailObj = {
      title: payload.title,
      scheduled_at: payload.scheduledAt || null,
      ...(payload.details || {}),
    }

    await supabase.from('change_logs').insert({
      family_id: payload.familyId,
      actor_name: payload.actorName || 'Familiar',
      entity: payload.entity,
      entity_id: payload.entityId ? String(payload.entityId) : 'general',
      action: payload.action,
      details: detailObj,
    })
  } catch (error) {
    console.error('Error al registrar auditoría en change_logs:', error)
  }
}
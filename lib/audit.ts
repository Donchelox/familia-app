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
    let moduleName = 'General'
    if (payload.entity === 'medication' || payload.entity === 'dose') {
      moduleName = 'Medicinas'
    } else if (
      payload.entity === 'school_test' ||
      payload.entity === 'school_homework' ||
      payload.entity === 'school_schedule'
    ) {
      moduleName = 'Colegio'
    } else if (payload.entity === 'shopping') {
      const isFeria = (payload.details?.list || '').toLowerCase() === 'feria' || payload.title.toLowerCase().includes('feria')
      moduleName = isFeria ? 'Feria' : 'Supermercado'
    } else if (payload.entity === 'todo') {
      moduleName = 'Tareas'
    } else if (payload.entity === 'member') {
      moduleName = 'Familia'
    }

    let actionName = payload.action as string
    if (payload.action === 'create') actionName = 'añadido'
    else if (payload.action === 'update') actionName = 'editado'
    else if (payload.action === 'delete') actionName = 'eliminado'
    else if (payload.action === 'toggle') {
      if (payload.entity === 'dose') {
        actionName = payload.details?.currentTaken ? 'dosis desmarcada' : 'dosis tomada'
      } else if (payload.entity === 'shopping') {
        actionName = payload.details?.done ? 'comprado' : 'marcado pendiente'
      } else if (payload.entity === 'todo') {
        actionName = payload.details?.done ? 'completada' : 'desmarcada'
      } else if (payload.entity === 'school_homework') {
        actionName = payload.details?.done ? 'tarea hecha' : 'tarea restaurada'
      } else {
        actionName = 'cambio de estado'
      }
    }

    let itemDesc = payload.title
    if (payload.scheduledAt && !payload.title.includes(payload.scheduledAt)) {
      itemDesc = `${payload.title} · ${payload.scheduledAt}`
    }

    await Promise.allSettled([
      supabase.from('activity_log').insert({
        family_id: payload.familyId,
        user_name: payload.actorName || 'Familiar',
        module: moduleName,
        action: actionName,
        item: itemDesc,
      }),
      supabase.from('change_logs').insert({
        family_id: payload.familyId,
        actor_name: payload.actorName || 'Familiar',
        entity: payload.entity,
        entity_id: payload.entityId,
        action: payload.action,
        details: {
          title: payload.title,
          scheduled_at: payload.scheduledAt,
          ...(payload.details || {}),
        },
      }),
    ])
  } catch (error) {
    console.error('Error al registrar auditoría en activity_log / change_logs:', error)
  }
}
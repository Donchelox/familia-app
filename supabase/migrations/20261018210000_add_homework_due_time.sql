-- =====================================================================
-- Migración: Horario de notificación para tareas de colegio (school_homework)
-- =====================================================================
-- Idempotente para ejecutar en Supabase SQL Editor
-- =====================================================================

alter table if exists school_homework
  add column if not exists due_time text default '08:00',
  add column if not exists last_notified_at timestamptz default null;

-- Índice para optimizar consultas de tareas pendientes por fecha y horario
create index if not exists idx_school_homework_due_notification
  on school_homework (family_id, due_date, due_time, done);

notify pgrst, 'reload schema';

-- =====================================================================
-- Migración: Recurrencia en Tareas del Hogar (Casa App)
-- =====================================================================

alter table todos
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null;

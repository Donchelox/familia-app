-- =====================================================================
-- Migración: Prioridad, Enlaces, Reordenamiento y Archivado para Tareas
-- =====================================================================

alter table todos
  add column if not exists priority text default 'normal',
  add column if not exists position integer default 0,
  add column if not exists archived boolean not null default false,
  add column if not exists link text,
  add column if not exists reminder_sent boolean not null default false;

create index if not exists idx_todos_family_archived on todos (family_id, archived);
create index if not exists idx_todos_family_position on todos (family_id, position);

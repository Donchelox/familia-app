-- =====================================================================
-- Migración: Subtareas (Checklists), Detalles y Categorías para Tareas
-- =====================================================================

-- 1. Añadir columnas a la tabla 'todos': details, category, subtasks
alter table todos
  add column if not exists details text,
  add column if not exists category text,
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

-- 2. Crear tabla para categorías de tareas familiares
create table if not exists todo_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  color text default '#F76911',
  created_at timestamptz not null default now(),
  constraint todo_categories_family_name_unique unique (family_id, name)
);

create index if not exists idx_todo_categories_family_id on todo_categories (family_id);

-- 3. Habilitar RLS en todo_categories
alter table todo_categories enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'todo_categories' and policyname = 'ver todo_categories') then
    create policy "ver todo_categories" on todo_categories for select using (is_member(family_id));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'todo_categories' and policyname = 'editar todo_categories') then
    create policy "editar todo_categories" on todo_categories for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

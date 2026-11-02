-- =====================================================================
-- TABLA OPCIONAL PARA SINCRONIZACIÓN DE SUGERENCIAS DE ALMUERZOS
-- =====================================================================
-- Esta tabla permite a las familias compartir su banco de sugerencias y recetas
-- caseras entre todos los integrantes en tiempo real.
-- 100% idempotente y seguro de ejecutar en Supabase Studio -> SQL Editor.
-- =====================================================================

create table if not exists lunch_suggestions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  category text not null default 'Caseros',
  starter text default null,
  dessert text default null,
  ingredients text[] default '{}',
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lunch_suggestions_family_id
  on lunch_suggestions (family_id);

alter table if exists lunch_suggestions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lunch_suggestions' and policyname = 'ver lunch_suggestions'
  ) then
    create policy "ver lunch_suggestions" on lunch_suggestions
      for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'lunch_suggestions' and policyname = 'editar lunch_suggestions'
  ) then
    create policy "editar lunch_suggestions" on lunch_suggestions
      for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

notify pgrst, 'reload schema';

-- =====================================================================
-- Migración: Minutas de Almuerzo para todos los días de la semana
-- =====================================================================

create table if not exists lunch_menus (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- 1: Lunes, 7: Domingo
  week_start date not null, -- Fecha (lunes) que identifica la semana
  main_dish text not null, -- Plato principal / fondo
  starter text, -- Entrada / Ensalada / Sopa
  dessert text, -- Postre
  drink text, -- Bebida / Jugo
  cook_name text, -- Quién cocina / Asignado a
  notes text, -- Notas o instrucciones
  ingredients text[] default '{}', -- Lista de ingredientes necesarios
  done boolean not null default false, -- Si el almuerzo ya se preparó / completó
  created_at timestamptz not null default now(),
  constraint lunch_menus_family_day_week_unique unique (family_id, day_of_week, week_start)
);

create index if not exists idx_lunch_menus_family_week on lunch_menus (family_id, week_start);
create index if not exists idx_lunch_menus_family_day on lunch_menus (family_id, day_of_week);

-- Habilitar RLS
alter table lunch_menus enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'lunch_menus' and policyname = 'ver lunch_menus') then
    create policy "ver lunch_menus" on lunch_menus for select using (is_member(family_id));
  end if;

  if not exists (select 1 from pg_policies where tablename = 'lunch_menus' and policyname = 'editar lunch_menus') then
    create policy "editar lunch_menus" on lunch_menus for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

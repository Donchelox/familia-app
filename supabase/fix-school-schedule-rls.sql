-- =====================================================================
-- FIX DE SEGURIDAD RLS PARA TABLA school_schedule
-- =====================================================================
-- Este script es 100% IDEMPOTENTE y seguro de ejecutar en:
-- Supabase Studio -> SQL Editor -> New Query -> Run
-- Garantiza que la tabla de horarios exista y cuente con Row Level Security
-- activado con políticas multi-tenancy para miembros y editores.
-- =====================================================================

create table if not exists school_schedule (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  day smallint not null check (day between 1 and 7),
  subject text not null,
  time_start text not null,
  time_end text not null,
  teacher_initials text default null,
  valid_until date default '2026-12-31',
  created_at timestamptz not null default now()
);

create index if not exists idx_school_schedule_family_day
  on school_schedule (family_id, day);

alter table if exists school_schedule enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'school_schedule' and policyname = 'ver school_schedule'
  ) then
    create policy "ver school_schedule" on school_schedule
      for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'school_schedule' and policyname = 'editar school_schedule'
  ) then
    create policy "editar school_schedule" on school_schedule
      for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

notify pgrst, 'reload schema';

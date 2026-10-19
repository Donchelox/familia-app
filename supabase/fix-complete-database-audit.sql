-- =====================================================================
-- FIX INTEGRAL DE BASE DE DATOS Y CONECTIVIDAD SUPABASE (Casa App)
-- =====================================================================
-- Este script es 100% IDEMPOTENTE y seguro de ejecutar múltiples veces en:
-- Supabase Studio -> SQL Editor -> New Query -> Run
-- Corrige todos los errores de sincronización, tablas faltantes,
-- funciones RPC sobrecargadas y columnas faltantes detectadas en la auditoría.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLA: shopping_items (Soluciona error SyncManager en Super y Feria)
-- ---------------------------------------------------------------------
alter table if exists shopping_items
  add column if not exists category text,
  add column if not exists quantity text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval_days integer default null,
  add column if not exists last_notified_at timestamptz default null;

create index if not exists idx_shopping_items_family_recurrence
  on shopping_items (family_id, is_recurring, done);

-- ---------------------------------------------------------------------
-- 2. TABLA: family_members (Vinculación de usuarios, avatares y roles)
-- ---------------------------------------------------------------------
alter table if exists family_members
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists avatar_url text default null,
  add column if not exists is_child boolean not null default false,
  add column if not exists is_pet boolean not null default false;

create index if not exists idx_family_members_user_id
  on family_members (user_id);

-- Limpiar posibles duplicados históricos en family_members conservando el registro más antiguo
delete from family_members a
using family_members b
where a.family_id = b.family_id
  and a.user_id is not null
  and a.user_id = b.user_id
  and a.created_at > b.created_at;

-- Índice único para garantizar que nunca se duplique un usuario en la misma familia
create unique index if not exists idx_family_members_unique_user
  on family_members (family_id, user_id)
  where user_id is not null;

-- Asegurar políticas RLS para family_members (lectura para miembros, edición administradores)
alter table if exists family_members enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'ver integrantes'
  ) then
    create policy "ver integrantes" on family_members for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'admin gestiona integrantes'
  ) then
    create policy "admin gestiona integrantes" on family_members for all
      using (is_admin(family_id)) with check (is_admin(family_id));
  end if;

  -- Permitir que un usuario actualice su propio user_id en su ficha
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'family_members' and policyname = 'usuario vincula su ficha'
  ) then
    create policy "usuario vincula su ficha" on family_members for update
      using (is_member(family_id)) with check (is_member(family_id));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. TABLA: families (Preferencias de resúmenes matutinos e intervalos)
-- ---------------------------------------------------------------------
alter table if exists families
  add column if not exists daily_summary_time text default '07:30',
  add column if not exists morning_summary_enabled boolean not null default true,
  add column if not exists daily_summary_enabled boolean not null default true,
  add column if not exists custom_name text default null,
  add column if not exists med_reminder_interval integer not null default 5,
  add column if not exists reminder_push_detail boolean not null default false;

-- ---------------------------------------------------------------------
-- 4. TABLA: school_tests (Colegio - Evaluaciones)
-- ---------------------------------------------------------------------
alter table if exists school_tests
  add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------
-- 4.1 TABLA: school_homework (Colegio - Tareas y Horarios de Notificación)
-- ---------------------------------------------------------------------
alter table if exists school_homework
  add column if not exists due_time text default '08:00',
  add column if not exists last_notified_at timestamptz default null;

create index if not exists idx_school_homework_due_notification
  on school_homework (family_id, due_date, due_time, done);

-- ---------------------------------------------------------------------
-- 5. TABLA: invites (Invitaciones a la Familia)
-- ---------------------------------------------------------------------
alter table if exists invites
  add column if not exists expires_at timestamptz default null,
  add column if not exists code text default null,
  add column if not exists used boolean default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. TABLA: change_logs (Historial de Auditoría y Panel de Registro)
-- ---------------------------------------------------------------------
create table if not exists change_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  entity text not null,
  entity_id text,
  action text not null,
  actor_name text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table change_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'change_logs' and policyname = 'ver change_logs'
  ) then
    create policy "ver change_logs" on change_logs
      for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'change_logs' and policyname = 'insertar change_logs'
  ) then
    create policy "insertar change_logs" on change_logs
      for insert with check (can_edit(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'change_logs' and policyname = 'admin gestiona change_logs'
  ) then
    create policy "admin gestiona change_logs" on change_logs
      for all using (is_admin(family_id)) with check (is_admin(family_id));
  end if;
end $$;

create index if not exists idx_change_logs_family_created
  on change_logs (family_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. TABLA: push_subscriptions (Garantizar unicidad de endpoint)
-- ---------------------------------------------------------------------
create unique index if not exists idx_push_subs_endpoint_unique
  on push_subscriptions (endpoint);

-- ---------------------------------------------------------------------
-- 8. RPC: claim_invites (Eliminar sobrecarga duplicada y recrear unificada)
-- ---------------------------------------------------------------------
-- IMPORTANTE: Elimina las firmas duplicadas que causan el error 42725
drop function if exists public.claim_invites();
drop function if exists public.claim_invites(text);

create or replace function public.claim_invites(target_email text default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  u_email text;
  u_id uuid;
  u_name text;
  n int := 0;
begin
  u_id := auth.uid();
  if u_id is null then
    return 0;
  end if;

  -- 1. Obtener email del usuario (argumento explícito, tabla auth.users o jwt)
  u_email := lower(trim(coalesce(
    nullif(target_email, ''),
    (select email from auth.users where id = u_id),
    auth.jwt() ->> 'email'
  )));

  if u_email is null or u_email = '' then
    return 0;
  end if;

  -- 2. Obtener nombre del usuario
  select coalesce(
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''),
    split_part(u_email, '@', 1)
  )
  into u_name
  from auth.users where id = u_id;

  -- 3. Vincular como miembro en la tabla members
  insert into members (family_id, user_id, email, display_name, role)
  select
    i.family_id,
    u_id,
    u_email,
    coalesce(u_name, split_part(u_email, '@', 1)),
    i.role
  from invites i
  where lower(trim(i.email)) = u_email
    and (i.expires_at is null or i.expires_at > now())
  on conflict (family_id, user_id) do update
    set role = excluded.role,
        display_name = coalesce(members.display_name, excluded.display_name);

  get diagnostics n = row_count;

  -- 4. Eliminar invitaciones reclamadas
  delete from invites
  where lower(trim(email)) = u_email
    and (expires_at is null or expires_at > now());

  -- 5. Vincular user_id en family_members si existe registro previo
  update family_members fm
  set user_id = u_id
  where fm.user_id is null
    and fm.family_id in (select family_id from members where user_id = u_id)
    and (lower(trim(fm.name)) = lower(trim(u_name)) or fm.type = 'adult');

  return n;
end $$;

grant execute on function public.claim_invites(text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. RPC: register_push_subscription (Suscripciones Push Web)
-- ---------------------------------------------------------------------
create or replace function public.register_push_subscription(
  endpoint_val text,
  p256dh_val text,
  auth_val text,
  family_id_val uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sub_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if not is_member(family_id_val) then
    raise exception 'No eres miembro de esta familia';
  end if;

  insert into push_subscriptions (user_id, family_id, endpoint, p256dh, auth)
  values (auth.uid(), family_id_val, endpoint_val, p256dh_val, auth_val)
  on conflict (endpoint) do update
  set user_id = auth.uid(),
      family_id = family_id_val,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      created_at = now()
  returning id into sub_id;

  return sub_id;
end $$;

revoke execute on function public.register_push_subscription(text, text, text, uuid) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. RPC: create_family (Resiliente a inicios de sesión sin email en JWT)
-- ---------------------------------------------------------------------
create or replace function public.create_family(fname text, dname text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
  u_email text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select lower(trim(coalesce(email, auth.jwt() ->> 'email', '')))
  into u_email
  from auth.users where id = auth.uid();

  insert into families (name) values (fname) returning id into fid;

  insert into members (family_id, user_id, email, display_name, role)
  values (fid, auth.uid(), u_email, dname, 'admin');

  -- Registrar automáticamente al creador en family_members como adulto
  insert into family_members (family_id, name, role, type, user_id)
  values (fid, coalesce(nullif(trim(dname), ''), 'Administrador'), 'Administrador', 'adult', auth.uid())
  on conflict do nothing;

  return fid;
end $$;

grant execute on function public.create_family(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. Recargar caché de esquema de PostgREST
-- ---------------------------------------------------------------------
notify pgrst, 'reload schema';

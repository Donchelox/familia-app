-- =====================================================================
-- Migración Fase 1: Endurecimiento de Base de Datos y Seguridad (Casa App)
-- Idempotente y segura para ejecución en Supabase SQL Editor o Supabase CLI
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.10 Tabla push_subscriptions (si no existe) y RLS
-- ---------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  family_id uuid not null references families on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' loop
    execute format('drop policy %I on push_subscriptions', p.policyname);
  end loop;
end $$;

create policy "push_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid() and is_member(family_id));

create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid() and is_member(family_id));

create policy "push_subscriptions_update" on push_subscriptions
  for update using (user_id = auth.uid() and is_member(family_id))
  with check (user_id = auth.uid() and is_member(family_id));

create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid() and is_member(family_id));

-- Función security definer para registrar/reasignar endpoint de dispositivo entre usuarios
create or replace function register_push_subscription(
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

revoke execute on function register_push_subscription(text, text, text, uuid) from public, anon;
grant execute on function register_push_subscription(text, text, text, uuid) to authenticated;

-- dose_reminders: RLS activada y sin acceso para authenticated (solo service role)
alter table if exists dose_reminders enable row level security;
do $$
declare p record;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dose_reminders') then
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'dose_reminders' loop
      execute format('drop policy %I on dose_reminders', p.policyname);
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.1 Revocar EXECUTE a public/anon y conceder solo a authenticated
-- ---------------------------------------------------------------------
revoke execute on function is_member(uuid) from public, anon;
grant execute on function is_member(uuid) to authenticated;

revoke execute on function can_edit(uuid) from public, anon;
grant execute on function can_edit(uuid) to authenticated;

revoke execute on function is_admin(uuid) from public, anon;
grant execute on function is_admin(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'create_family' and pronargs = 2) then
    execute 'revoke execute on function create_family(text, text) from public, anon';
    execute 'grant execute on function create_family(text, text) to authenticated';
  end if;

  if exists (select 1 from pg_proc where proname = 'claim_invites' and pronargs = 0) then
    execute 'revoke execute on function claim_invites() from public, anon';
    execute 'grant execute on function claim_invites() to authenticated';
  end if;

  if exists (select 1 from pg_proc where proname = 'claim_invites' and pronargs = 1) then
    execute 'revoke execute on function claim_invites(text) from public, anon';
    execute 'grant execute on function claim_invites(text) to authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.2 Trigger keep_one_admin en members (before update or delete)
-- ---------------------------------------------------------------------
create or replace function trg_keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'DELETE' then
    if OLD.role = 'admin' then
      -- Permitir si la familia fue eliminada (cascade)
      if exists (select 1 from families where id = OLD.family_id) then
        if not exists (
          select 1 from members 
          where family_id = OLD.family_id 
            and role = 'admin' 
            and user_id <> OLD.user_id
        ) then
          raise exception 'La familia debe tener al menos un administrador.';
        end if;
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'UPDATE' then
    if OLD.role = 'admin' and (NEW.role <> 'admin' or NEW.family_id <> OLD.family_id) then
      if exists (select 1 from families where id = OLD.family_id) then
        if not exists (
          select 1 from members 
          where family_id = OLD.family_id 
            and role = 'admin' 
            and user_id <> OLD.user_id
        ) then
          raise exception 'La familia debe tener al menos un administrador.';
        end if;
      end if;
    end if;
    return NEW;
  end if;
  return null;
end $$;

drop trigger if exists keep_one_admin on members;
create trigger keep_one_admin
before update or delete on members
for each row execute function trg_keep_one_admin();

-- ---------------------------------------------------------------------
-- 1.3 Restringir updates en members: solo columna role para authenticated
-- ---------------------------------------------------------------------
revoke update on members from authenticated;
grant update (role) on members to authenticated;

-- ---------------------------------------------------------------------
-- 1.4 Integridad compuesta entre familias (medications, dose_logs, dose_reminders)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'medications_id_family_id_key'
  ) then
    alter table medications add constraint medications_id_family_id_key unique (id, family_id);
  end if;
end $$;

do $$
declare
  c_name text;
begin
  for c_name in (
    select conname from pg_constraint 
    where conrelid = 'dose_logs'::regclass 
      and confrelid = 'medications'::regclass
  ) loop
    execute format('alter table dose_logs drop constraint %I', c_name);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'dose_logs_medication_family_fk') then
    alter table dose_logs 
      add constraint dose_logs_medication_family_fk 
      foreign key (medication_id, family_id) 
      references medications (id, family_id) 
      on delete cascade;
  end if;
end $$;

do $$
declare
  c_name text;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'dose_reminders') then
    for c_name in (
      select conname from pg_constraint 
      where conrelid = 'dose_reminders'::regclass 
        and confrelid = 'medications'::regclass
    ) loop
      execute format('alter table dose_reminders drop constraint %I', c_name);
    end loop;

    if not exists (select 1 from pg_constraint where conname = 'dose_reminders_medication_family_fk') then
      alter table dose_reminders 
        add constraint dose_reminders_medication_family_fk 
        foreign key (medication_id, family_id) 
        references medications (id, family_id) 
        on delete cascade;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.5 Límites con CHECK (families, shopping_items, todos, medications)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'families_name_length_check') then
    alter table families add constraint families_name_length_check 
      check (char_length(name) between 1 and 80);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'shopping_items_name_length_check') then
    alter table shopping_items add constraint shopping_items_name_length_check 
      check (char_length(name) between 1 and 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'todos_title_length_check') then
    alter table todos add constraint todos_title_length_check 
      check (char_length(title) between 1 and 200);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'medications_name_length_check') then
    alter table medications add constraint medications_name_length_check 
      check (char_length(name) between 1 and 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'medications_dose_length_check') then
    alter table medications add constraint medications_dose_length_check 
      check (dose is null or char_length(dose) <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'medications_times_cardinality_check') then
    alter table medications add constraint medications_times_cardinality_check 
      check (cardinality(times) between 1 and 12);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.6 Índices en family_id
-- ---------------------------------------------------------------------
create index if not exists idx_shopping_items_family_id on shopping_items (family_id);
create index if not exists idx_todos_family_id on todos (family_id);
create index if not exists idx_school_blocks_family_id on school_blocks (family_id);
create index if not exists idx_school_tests_family_id on school_tests (family_id);
create index if not exists idx_school_homework_family_id on school_homework (family_id);
create index if not exists idx_medications_family_id on medications (family_id);
create index if not exists idx_dose_logs_family_id on dose_logs (family_id);
create index if not exists idx_dose_reminders_family_id on dose_reminders (family_id);
create index if not exists idx_push_subscriptions_family_id on push_subscriptions (family_id);

-- ---------------------------------------------------------------------
-- 1.7 Invitaciones: expires_at, email en minúsculas y claim_invites
-- ---------------------------------------------------------------------
alter table invites add column if not exists expires_at timestamptz default (now() + interval '14 days');

create or replace function trg_invites_lowercase_email()
returns trigger language plpgsql as $$
begin
  NEW.email := lower(trim(NEW.email));
  return NEW;
end $$;

drop trigger if exists invites_lowercase_email on invites;
create trigger invites_lowercase_email
before insert or update on invites
for each row execute function trg_invites_lowercase_email();

do $$
begin
  update invites set email = lower(trim(email)) where email <> lower(trim(email));
  if not exists (select 1 from pg_constraint where conname = 'invites_email_lowercase_check') then
    alter table invites add constraint invites_email_lowercase_check 
      check (email = lower(trim(email)));
  end if;
end $$;

-- Actualizar claim_invites para ignorar invitaciones expiradas
create or replace function claim_invites(target_email text default null)
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

  u_email := lower(trim(coalesce(
    nullif(target_email, ''),
    (select email from auth.users where id = u_id),
    auth.jwt() ->> 'email'
  )));

  if u_email is null or u_email = '' then
    return 0;
  end if;

  select coalesce(
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''),
    split_part(u_email, '@', 1)
  )
  into u_name
  from auth.users where id = u_id;

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

  -- Eliminar invitaciones reclamadas
  delete from invites 
  where lower(trim(email)) = u_email 
    and (expires_at is null or expires_at > now());

  -- Vincular ficha de adulto si existe
  update family_members fm
  set user_id = u_id
  where fm.user_id is null
    and fm.family_id in (select family_id from members where user_id = u_id)
    and (lower(trim(fm.name)) = lower(trim(u_name)) or fm.type = 'adult');

  return n;
end $$;

-- ---------------------------------------------------------------------
-- 1.8 create_family: rechazar si el usuario ya es admin de 3 o más familias
-- ---------------------------------------------------------------------
create or replace function create_family(fname text, dname text) 
returns uuid language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
  admin_count int;
  user_email text;
begin
  if auth.uid() is null then 
    raise exception 'No autenticado'; 
  end if;

  -- Rechazar si ya es admin de 3 o más familias
  select count(*) into admin_count 
  from members 
  where user_id = auth.uid() and role = 'admin';

  if admin_count >= 3 then
    raise exception 'Límite alcanzado: no puedes ser administrador de más de 3 familias.';
  end if;

  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    user_email := auth.jwt() ->> 'email';
  end if;

  insert into families (name) values (fname) returning id into fid;
  insert into members (family_id, user_id, email, display_name, role)
  values (fid, auth.uid(), lower(trim(user_email)), dname, 'admin');
  
  return fid;
end $$;

-- ---------------------------------------------------------------------
-- 1.9 activity_log: trigger before insert que fije user_name desde members.display_name
-- ---------------------------------------------------------------------
create or replace function trg_activity_log_user_name()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  d_name text;
begin
  if auth.uid() is not null then
    select display_name into d_name
    from members
    where family_id = NEW.family_id and user_id = auth.uid();

    if d_name is not null and trim(d_name) <> '' then
      NEW.user_name := trim(d_name);
    else
      select coalesce(
        nullif(trim(raw_user_meta_data->>'full_name'), ''),
        nullif(trim(raw_user_meta_data->>'name'), ''),
        split_part(email, '@', 1)
      ) into d_name
      from auth.users where id = auth.uid();

      NEW.user_name := coalesce(d_name, 'Familiar');
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists activity_log_set_user_name on activity_log;
create trigger activity_log_set_user_name
before insert on activity_log
for each row execute function trg_activity_log_user_name();

-- ---------------------------------------------------------------------
-- 1.11 Trigger en members (after delete) que borre las push_subscriptions
-- ---------------------------------------------------------------------
create or replace function trg_members_delete_push_subs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from push_subscriptions 
  where user_id = OLD.user_id and family_id = OLD.family_id;
  return OLD;
end $$;

drop trigger if exists members_delete_push_subs on members;
create trigger members_delete_push_subs
after delete on members
for each row execute function trg_members_delete_push_subs();

-- ---------------------------------------------------------------------
-- 1.12 Columna med_reminder_interval (y reminder_push_detail para Fase 3)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'families' 
      and column_name = 'med_reminder_interval'
  ) then
    alter table families add column med_reminder_interval smallint not null default 5;
  else
    alter table families alter column med_reminder_interval set default 5;
    alter table families alter column med_reminder_interval type smallint using med_reminder_interval::smallint;
    alter table families alter column med_reminder_interval set not null;
  end if;

  update families 
  set med_reminder_interval = 5 
  where med_reminder_interval not in (5, 10, 15, 30) or med_reminder_interval is null;

  if not exists (select 1 from pg_constraint where conname = 'families_med_reminder_interval_check') then
    alter table families add constraint families_med_reminder_interval_check 
      check (med_reminder_interval in (5, 10, 15, 30));
  end if;

  -- Columna para privacidad de notificaciones push (Fase 3.7)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'families' 
      and column_name = 'reminder_push_detail'
  ) then
    alter table families add column reminder_push_detail boolean not null default false;
  end if;
end $$;

-- Migración del valor actual desde user_metadata del admin (si existe)
do $$
begin
  update families f
  set med_reminder_interval = case 
    when (u.raw_user_meta_data->>'med_reminder_interval')::int in (5, 10, 15, 30)
      then (u.raw_user_meta_data->>'med_reminder_interval')::smallint
    else 5
  end
  from members m
  join auth.users u on u.id = m.user_id
  where m.family_id = f.id 
    and m.role = 'admin'
    and u.raw_user_meta_data->>'med_reminder_interval' is not null
    and (u.raw_user_meta_data->>'med_reminder_interval') ~ '^\d+$';
exception when others then
  update families set med_reminder_interval = 5 where med_reminder_interval is null;
end $$;

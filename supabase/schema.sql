-- Paso 1: familias, miembros con roles e invitaciones
create extension if not exists pgcrypto;
create type member_role as enum ('admin', 'editor', 'viewer');

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table members (
  family_id uuid not null references families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text,
  display_name text,
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  email text not null,
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (family_id, email)
);

-- Helpers de permisos (security definer evita recursión en RLS)
create function is_member(fid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = fid and user_id = auth.uid())
$$;
create function can_edit(fid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = fid and user_id = auth.uid() and role in ('admin','editor'))
$$;
create function is_admin(fid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where family_id = fid and user_id = auth.uid() and role = 'admin')
$$;

alter table families enable row level security;
alter table members enable row level security;
alter table invites enable row level security;

create policy "ver familia" on families for select using (is_member(id));
create policy "editar familia" on families for update using (is_admin(id));

create policy "ver miembros" on members for select using (is_member(family_id));
create policy "admin cambia roles" on members for update using (is_admin(family_id));
create policy "admin quita o salir" on members for delete using (is_admin(family_id) or user_id = auth.uid());

create policy "admin gestiona invitaciones" on invites for all using (is_admin(family_id)) with check (is_admin(family_id));

-- Crear familia (el creador queda como administrador)
create function create_family(fname text, dname text) returns uuid language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  insert into families (name) values (fname) returning id into fid;
  insert into members (family_id, user_id, email, display_name, role)
  values (fid, auth.uid(), lower(auth.jwt() ->> 'email'), dname, 'admin');
  return fid;
end $$;

-- Al entrar, el usuario reclama las invitaciones pendientes de su correo
create function claim_invites() returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into members (family_id, user_id, email, role)
  select family_id, auth.uid(), lower(email), role from invites
  where lower(email) = lower(auth.jwt() ->> 'email')
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from invites where lower(email) = lower(auth.jwt() ->> 'email');
  return n;
end $$;

-- =====================================================================
-- Módulos: supermercado/feria, tareas, colegio, medicamentos, registro
-- =====================================================================
alter table families
  add column reminder_email boolean not null default true,
  add column reminder_push boolean not null default true;

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  list text not null default 'super' check (list in ('super','feria')),
  name text not null,
  category text,
  quantity text,
  is_recurring boolean not null default false,
  recurrence_interval_days integer default null,
  last_notified_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table todos (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  title text not null,
  details text,
  category text,
  subtasks jsonb not null default '[]'::jsonb,
  is_recurring boolean not null default false,
  recurrence_interval_days integer default null,
  priority text default 'normal',
  position integer default 0,
  archived boolean not null default false,
  link text,
  reminder_sent boolean not null default false,
  assigned_to text,
  due_date timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table todo_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null,
  color text default '#F76911',
  created_at timestamptz not null default now(),
  constraint todo_categories_family_name_unique unique (family_id, name)
);

-- Horario por bloques (1 = primer bloque de la jornada; length 2 = clase doble)
create table school_blocks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  day smallint not null check (day between 1 and 5),
  start_block smallint not null check (start_block >= 1),
  length smallint not null default 1 check (length in (1,2)),
  subject text not null
);
create table school_slots (
  family_id uuid not null references families on delete cascade,
  block smallint not null,
  starts_at time not null,
  primary key (family_id, block)
);
create table school_tests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  subject text not null,
  topic text,
  test_date date not null
);
create table school_homework (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  subject text not null,
  task text not null,
  due date not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  person text not null,
  name text not null,
  dose text not null,
  times text[] not null,            -- ['08:00','20:00']
  frequency text default 'daily',
  end_date text,
  stock integer default null,
  stock_alert_threshold integer default 5,
  icon_type text default 'pill',
  instructions text default null,
  created_at timestamptz not null default now()
);
create table dose_logs (
  medication_id uuid not null references medications on delete cascade,
  family_id uuid not null references families on delete cascade,
  day date not null,
  time text not null,
  taken_at timestamptz not null default now(),
  primary key (medication_id, day, time)
);

create table lunch_menus (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  week_start date not null,
  main_dish text not null,
  starter text,
  dessert text,
  drink text,
  cook_name text,
  notes text,
  ingredients text[] default '{}',
  done boolean not null default false,
  created_at timestamptz not null default now(),
  constraint lunch_menus_family_day_week_unique unique (family_id, day_of_week, week_start)
);
create index on lunch_menus (family_id, week_start);
create index on lunch_menus (family_id, day_of_week);

-- Registro de actividad (no incluye medicamentos)
create table activity_log (
  id bigint generated always as identity primary key,
  family_id uuid not null references families on delete cascade,
  user_name text,
  module text not null,
  action text not null,
  item text,
  created_at timestamptz not null default now()
);
create index on activity_log (family_id, created_at);

-- RLS: ver = miembros; editar = admin y editor
do $$
declare t text;
begin
  foreach t in array array['shopping_items','todos','todo_categories','school_tests','school_homework','medications','dose_logs','lunch_menus'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "ver" on %I for select using (is_member(family_id))', t);
    execute format('create policy "editar" on %I for all using (can_edit(family_id)) with check (can_edit(family_id))', t);
  end loop;
  -- Horario del colegio: solo administradores editan
  foreach t in array array['school_blocks','school_slots'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "ver" on %I for select using (is_member(family_id))', t);
    execute format('create policy "administrar" on %I for all using (is_admin(family_id)) with check (is_admin(family_id))', t);
  end loop;
end $$;

alter table activity_log enable row level security;
create policy "admin ve registro" on activity_log for select using (is_admin(family_id));
create policy "editores registran" on activity_log for insert with check (can_edit(family_id));
create policy "admin vacía registro" on activity_log for delete using (is_admin(family_id));

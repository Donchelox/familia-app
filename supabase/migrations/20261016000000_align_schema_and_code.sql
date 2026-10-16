-- =====================================================================
-- Migración: Alineación del esquema con el código de la aplicación
-- Timestamp: 20261016000000 (posterior a 20261015190000)
-- Idempotente y segura de correr sobre bases nuevas o existentes
-- =====================================================================

-- 1. Tabla family_members (integrantes del hogar)
create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  user_id uuid references auth.users on delete set null,
  name text not null,
  role text not null default 'hijo',
  type text not null default 'child' check (type in ('adult', 'child')),
  created_at timestamptz not null default now()
);

create index if not exists idx_family_members_family_id on family_members (family_id);
create index if not exists idx_family_members_user_id on family_members (user_id);

alter table family_members enable row level security;
drop policy if exists "ver integrantes" on family_members;
create policy "ver integrantes" on family_members for select using (is_member(family_id));

drop policy if exists "admin gestiona integrantes" on family_members;
create policy "admin gestiona integrantes" on family_members for all
  using (is_admin(family_id)) with check (is_admin(family_id));

-- 2. Columnas en families (recordatorios e intervalos)
alter table families add column if not exists med_reminder_interval int not null default 5;
alter table families add column if not exists reminder_push_detail boolean not null default false;

-- 3. Columnas en shopping_items (categoría y cantidad)
alter table shopping_items
  add column if not exists category text,
  add column if not exists quantity text;

-- 4. Columnas en todos (asignación y fecha de vencimiento)
alter table todos
  add column if not exists assigned_to text,
  add column if not exists due_date timestamptz;

-- 5. Columnas en medications (frecuencia y fecha de término)
alter table medications
  add column if not exists frequency text,
  add column if not exists end_date date;

-- 6. Columnas en school_homework (compatibilidad con title y due_date)
alter table school_homework
  add column if not exists title text,
  add column if not exists due_date date;

-- 7. Columnas en school_tests (timestamp de creación)
alter table school_tests
  add column if not exists created_at timestamptz not null default now();

-- 8. Tabla school_schedule (horarios escolares por bloque horario)
create table if not exists school_schedule (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  day text not null,
  subject text not null,
  time_start text not null,
  time_end text not null,
  teacher_initials text,
  valid_until date default '2026-12-31',
  created_at timestamptz not null default now()
);

create index if not exists idx_school_schedule_family_id on school_schedule (family_id);

alter table school_schedule enable row level security;
drop policy if exists "ver school_schedule" on school_schedule;
create policy "ver school_schedule" on school_schedule for select using (is_member(family_id));

drop policy if exists "editar school_schedule" on school_schedule;
create policy "editar school_schedule" on school_schedule for all
  using (can_edit(family_id)) with check (can_edit(family_id));

-- 9. Tabla dose_reminders (seguimiento de intervalos de notificación de medicamentos)
create table if not exists dose_reminders (
  medication_id uuid not null references medications on delete cascade,
  family_id uuid not null references families on delete cascade,
  day date not null,
  time text not null,
  first_sent_at timestamptz not null default now(),
  last_slot int not null default 0,
  primary key (medication_id, day, time)
);

create index if not exists idx_dose_reminders_day on dose_reminders (day);
alter table dose_reminders enable row level security;

-- 10. Tabla push_subscriptions (suscripciones Web Push de navegadores)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  family_id uuid not null references families on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on push_subscriptions (user_id);
create index if not exists idx_push_subs_family on push_subscriptions (family_id);
alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select" on push_subscriptions;
create policy "push_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid() and is_member(family_id));

drop policy if exists "push_subscriptions_insert" on push_subscriptions;
create policy "push_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid() and is_member(family_id));

drop policy if exists "push_subscriptions_update" on push_subscriptions;
create policy "push_subscriptions_update" on push_subscriptions
  for update using (user_id = auth.uid() and is_member(family_id))
  with check (user_id = auth.uid() and is_member(family_id));

drop policy if exists "push_subscriptions_delete" on push_subscriptions;
create policy "push_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid() and is_member(family_id));

-- 11. Columnas de auditoría extendida en activity_log
alter table activity_log
  add column if not exists entity text,
  add column if not exists entity_id text,
  add column if not exists title text,
  add column if not exists scheduled_at text,
  add column if not exists details jsonb;

-- 12. Tabla change_logs (registro estructurado para visualizador de cambios)
create table if not exists change_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  entity text,
  entity_id text,
  action text,
  actor_name text,
  title text,
  scheduled_at text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_change_logs_family_id on change_logs (family_id, created_at desc);
alter table change_logs enable row level security;

drop policy if exists "ver change_logs" on change_logs;
create policy "ver change_logs" on change_logs for select using (is_member(family_id));

drop policy if exists "insert change_logs" on change_logs;
create policy "insert change_logs" on change_logs for insert with check (can_edit(family_id));

drop policy if exists "admin borra change_logs" on change_logs;
create policy "admin borra change_logs" on change_logs for delete using (is_admin(family_id));

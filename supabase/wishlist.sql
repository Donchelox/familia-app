-- =====================================================================
-- TABLA PARA WISHLIST Y REGALOS FAMILIARES (PERSONAS EXTERNAS)
-- =====================================================================
-- Permite registrar destinatarios de regalos (amigos, familiares externos)
-- y las ideas de regalos asociadas, visibles para todos los miembros de la familia.
-- 100% idempotente y seguro de ejecutar en Supabase Studio -> SQL Editor.
-- =====================================================================

-- 1. Tabla de destinatarios / personas externas
create table if not exists wishlist_recipients (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null,
  relationship text default '',
  notes text default '',
  avatar_color text default 'rose',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wishlist_recipients_family_id
  on wishlist_recipients (family_id);

alter table if exists wishlist_recipients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'wishlist_recipients' and policyname = 'ver wishlist_recipients'
  ) then
    create policy "ver wishlist_recipients" on wishlist_recipients
      for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'wishlist_recipients' and policyname = 'editar wishlist_recipients'
  ) then
    create policy "editar wishlist_recipients" on wishlist_recipients
      for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

-- 2. Tabla de ideas de regalos
create table if not exists wishlist_gifts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  recipient_id uuid not null references wishlist_recipients(id) on delete cascade,
  title text not null,
  notes text default '',
  price text default '',
  url text default '',
  is_bought boolean not null default false,
  buyer_name text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wishlist_gifts_family_id
  on wishlist_gifts (family_id);

create index if not exists idx_wishlist_gifts_recipient_id
  on wishlist_gifts (recipient_id);

alter table if exists wishlist_gifts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'wishlist_gifts' and policyname = 'ver wishlist_gifts'
  ) then
    create policy "ver wishlist_gifts" on wishlist_gifts
      for select using (is_member(family_id));
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'wishlist_gifts' and policyname = 'editar wishlist_gifts'
  ) then
    create policy "editar wishlist_gifts" on wishlist_gifts
      for all using (can_edit(family_id)) with check (can_edit(family_id));
  end if;
end $$;

notify pgrst, 'reload schema';

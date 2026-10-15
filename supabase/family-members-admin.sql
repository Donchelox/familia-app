-- Integrantes del hogar (family_members): todos los miembros los ven, solo el administrador los gestiona.
-- Así un "editor" invitado no puede añadir, editar ni borrar integrantes aunque llame a la API directo.
alter table family_members enable row level security;

-- Reemplaza las políticas que existan en la tabla
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'family_members' loop
    execute format('drop policy %I on family_members', p.policyname);
  end loop;
end $$;

create policy "ver integrantes" on family_members for select using (is_member(family_id));
create policy "admin gestiona integrantes" on family_members for all
  using (is_admin(family_id)) with check (is_admin(family_id));

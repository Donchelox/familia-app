-- Arregla el reclamo de invitaciones para que funcione siempre:
-- Ya sea que el usuario entre por link mágico, código OTP de 6 dígitos o login directo.
-- Obtiene el correo de forma segura desde auth.users o el parámetro target_email,
-- sin depender de que auth.jwt() contenga el claim 'email'.

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

  -- 1. Obtener el correo del usuario (del argumento, o de auth.users, o del token JWT)
  u_email := lower(trim(coalesce(
    nullif(target_email, ''),
    (select email from auth.users where id = u_id),
    auth.jwt() ->> 'email'
  )));

  if u_email is null or u_email = '' then
    return 0;
  end if;

  -- 2. Nombre del usuario para mostrar en la familia
  select coalesce(
    nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''),
    split_part(u_email, '@', 1)
  )
  into u_name
  from auth.users where id = u_id;

  -- 3. Vincular al usuario como miembro en la familia con el rol asignado en la invitación
  insert into members (family_id, user_id, email, display_name, role)
  select
    i.family_id,
    u_id,
    u_email,
    coalesce(u_name, split_part(u_email, '@', 1)),
    i.role
  from invites i
  where lower(trim(i.email)) = u_email
  on conflict (family_id, user_id) do update
    set role = excluded.role,
        display_name = coalesce(members.display_name, excluded.display_name);

  get diagnostics n = row_count;

  -- 4. Borrar las invitaciones ya reclamadas
  delete from invites where lower(trim(email)) = u_email;

  -- 5. Si existe una ficha en family_members con ese nombre o en esa familia, vincular el user_id
  update family_members fm
  set user_id = u_id
  where fm.user_id is null
    and fm.family_id in (select family_id from members where user_id = u_id)
    and (lower(trim(fm.name)) = lower(trim(u_name)) or fm.type = 'adult');

  return n;
end $$;

-- Permitir que usuarios autenticados ejecuten la función
grant execute on function claim_invites(text) to authenticated;
grant execute on function claim_invites() to authenticated;

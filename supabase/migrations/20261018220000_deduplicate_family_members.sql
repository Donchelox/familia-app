-- Migración: Deduplicar integrantes y prevenir duplicación de usuarios en family_members
-- ---------------------------------------------------------------------

-- 1. Eliminar duplicados históricos conservando el registro original más antiguo
delete from family_members a
using family_members b
where a.family_id = b.family_id
  and a.user_id is not null
  and a.user_id = b.user_id
  and a.created_at > b.created_at;

-- 2. Crear índice único condicional para evitar concurrencia de inserción para el mismo usuario
create unique index if not exists idx_family_members_unique_user
  on family_members (family_id, user_id)
  where user_id is not null;

-- Crear automáticamente el perfil de cada usuario nuevo de auth.users (parte 1:
-- valores por defecto y función; el trigger va en la migración siguiente).
--
-- Todo usuario nuevo nace con rol 'consulta' e INACTIVO: el administrador lo
-- activa y le asigna rol desde Configuración → Usuarios. El rol NUNCA se toma
-- de raw_user_meta_data, porque el cliente controla esos metadatos al
-- registrarse (supabase.auth.signUp) y podría auto-asignarse privilegios.

alter table public.profiles
  alter column role set default 'consulta',
  alter column active set default false;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'consulta',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, full_name, role, active)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(u.email, ''), '@', 1)
  ),
  'consulta',
  false
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- Lista de técnicos activos para asignar órdenes.
--
-- La política de profiles solo deja a cada usuario ver su propio perfil (salvo
-- al administrador). Esta función expone únicamente id y nombre de los perfiles
-- con rol 'tecnico' activos, y solo a administrador y supervisor.

create or replace function public.listar_tecnicos_activos()
returns table (id uuid, nombre text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
#variable_conflict use_column
begin
  if coalesce(private.current_user_role(), '') not in ('administrador', 'supervisor') then
    raise exception 'No autorizado para consultar la lista de técnicos'
      using errcode = '42501';
  end if;

  return query
    select p.id, coalesce(nullif(trim(p.full_name), ''), 'Técnico sin nombre')
    from public.profiles p
    where p.role = 'tecnico'
      and p.active = true
    order by 2;
end;
$$;

revoke all on function public.listar_tecnicos_activos() from public, anon;
grant execute on function public.listar_tecnicos_activos() to authenticated;

notify pgrst, 'reload schema';

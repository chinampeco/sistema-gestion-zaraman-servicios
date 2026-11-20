-- Verificación en dos pasos obligatoria para Administrador y Coordinador
-- también en la base de datos: con solo la contraseña (sesión aal1) esas
-- cuentas no ven datos de ninguna empresa ni tienen permisos de gestión,
-- aunque alguien intente usar la API directamente.

create or replace function public.dos_pasos_cumplido()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           (select p.rol not in ('Administrador', 'Coordinador') from public.profiles p where p.id = auth.uid()),
           true
         )
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
revoke execute on function public.dos_pasos_cumplido() from public, anon;
grant execute on function public.dos_pasos_cumplido() to authenticated;

-- Empresas visibles: sin la verificación no hay ninguna (todas las tablas de
-- negocio filtran por empresa con la política restrictiva *_solo_empresa_activa).
create or replace function public.empresas_del_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ue.empresa_id
    from public.usuario_empresas ue
    join public.empresas e on e.id = ue.empresa_id
   where ue.usuario_id = auth.uid() and ue.activo and e.activa
     and public.dos_pasos_cumplido()
  union
  -- Un cliente del portal pertenece a la empresa de su ficha de cliente.
  select c.empresa_id
    from public.profiles p
    join public.clientes c on c.id = p.cliente_id
    join public.empresas e on e.id = c.empresa_id
   where p.id = auth.uid() and p.rol = 'Cliente' and e.activa
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce((select rol from public.profiles where id = auth.uid()) = 'Administrador', false)
     and public.dos_pasos_cumplido()
$$;

create or replace function public.puede_gestionar_operacion()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.rol in ('Administrador', 'Coordinador', 'Supervisor') and p.activo
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  ) and public.dos_pasos_cumplido()
$$;

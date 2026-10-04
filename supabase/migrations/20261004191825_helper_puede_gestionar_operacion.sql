-- Base real: ynpvetdujkpxuaplsona.
-- Helper de permisos para escritura operativa (garantías, asignación e
-- inventario). Sigue el patrón de is_admin()/is_staff()/is_tecnico(), pero
-- además exige que el perfil esté activo.
-- Equivale a puedeReasignarOrdenes() de lib/permisos.ts.

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
  )
$$;

revoke all on function public.puede_gestionar_operacion() from public, anon;
grant execute on function public.puede_gestionar_operacion() to authenticated;

-- Vínculo del usuario cliente con su empresa, y asignación de órdenes solo
-- para administrador y supervisor (el rol 'coordinador' no existe).
-- El rol 'cliente' se habilita en el CHECK de profiles.role en la migración
-- siguiente.

-- El administrador asigna la empresa al dar de alta el acceso; nunca se toma
-- del formulario de registro. RESTRICT: no se puede borrar una empresa
-- mientras tenga cuentas de acceso ligadas.
alter table public.profiles
  add column if not exists cliente_id uuid
  references public.clientes (id) on delete restrict;

create index if not exists profiles_cliente_id_idx on public.profiles (cliente_id);

-- Un usuario cliente siempre está ligado a una empresa, y solo los usuarios
-- cliente pueden estarlo.
alter table public.profiles
  add constraint profiles_cliente_id_coherente
  check ((role = 'cliente') = (cliente_id is not null));

-- Nadie, salvo un administrador, puede cambiar su rol, estado o empresa.
-- Sin esto, un usuario podría ligarse a cualquier empresa editando su propia
-- fila (la política profiles_admin_update le permite actualizarla).
create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Solo aplica a peticiones hechas por un usuario de la app (con sesión).
  -- Operaciones de servidor (service_role / panel de Supabase) no traen auth.uid().
  if (select auth.uid()) is not null
     and (select private.current_user_role()) is distinct from 'administrador' then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.cliente_id is distinct from old.cliente_id then
      raise exception 'Solo un administrador puede modificar el rol, estado o empresa de un usuario.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.asignar_orden_con_garantia_v2(
  p_orden_id uuid,
  p_tecnico_id uuid,
  p_historial jsonb,
  p_orden_origen_id uuid default null,
  p_tiene_garantia boolean default false,
  p_duracion_valor integer default null,
  p_duracion_unidad text default null,
  p_cobertura text default null,
  p_condiciones text default null,
  p_resultado text default 'Pendiente'
)
returns public.ordenes_servicio
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_orden public.ordenes_servicio;
  v_rol text;
begin
  v_rol := private.current_user_role();
  if v_rol is null or v_rol not in ('administrador', 'supervisor') then
    raise exception 'No autorizado para asignar órdenes y configurar garantías';
  end if;

  if p_tiene_garantia and p_duracion_valor is not null and p_duracion_valor <= 0 then
    raise exception 'La duración de la garantía debe ser mayor que cero';
  end if;

  update public.ordenes_servicio
  set tecnico_id = p_tecnico_id,
      estado = 'Asignada',
      historial = coalesce(p_historial, '[]'::jsonb),
      updated_at = now()
  where id = p_orden_id
  returning * into v_orden;

  if v_orden.id is null then
    raise exception 'La orden no existe';
  end if;

  insert into public.orden_garantias (
    orden_id, orden_origen_id, tiene_garantia, duracion_valor, duracion_unidad,
    fecha_inicio, fecha_fin, cobertura, condiciones, resultado
  )
  values (
    p_orden_id, p_orden_origen_id, p_tiene_garantia,
    case when p_tiene_garantia then p_duracion_valor else null end,
    case when p_tiene_garantia then p_duracion_unidad else null end,
    null, null,
    case when p_tiene_garantia then p_cobertura else null end,
    case when p_tiene_garantia then p_condiciones else null end,
    p_resultado
  )
  on conflict (orden_id) do update set
    orden_origen_id = excluded.orden_origen_id,
    tiene_garantia = excluded.tiene_garantia,
    duracion_valor = excluded.duracion_valor,
    duracion_unidad = excluded.duracion_unidad,
    fecha_inicio = excluded.fecha_inicio,
    fecha_fin = excluded.fecha_fin,
    cobertura = excluded.cobertura,
    condiciones = excluded.condiciones,
    resultado = excluded.resultado;

  return v_orden;
end;
$$;

notify pgrst, 'reload schema';

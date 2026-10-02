create or replace function public.asignar_orden_con_garantia(
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

  if v_rol is null or v_rol not in ('administrador', 'coordinador', 'supervisor') then
    raise exception 'No autorizado para asignar órdenes y configurar garantías';
  end if;

  if not exists (
    select 1
    from public.tecnicos t
    where t.id = p_tecnico_id
      and coalesce(t.activo, true) = true
  ) then
    raise exception 'El técnico seleccionado no existe o está inactivo';
  end if;

  if p_orden_origen_id is null and p_tiene_garantia
     and (p_duracion_valor is null or p_duracion_valor <= 0) then
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

revoke all on function public.asignar_orden_con_garantia(uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text) from public;
grant execute on function public.asignar_orden_con_garantia(uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text) to authenticated;
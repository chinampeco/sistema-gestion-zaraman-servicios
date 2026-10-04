-- Base real: ynpvetdujkpxuaplsona.
-- RPC atómica que usa lib/store.tsx (asignarOrdenConGarantia): asigna el
-- técnico (tecnicos.id) y guarda la configuración de garantía en una sola
-- transacción. Misma firma que espera el código.

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
set search_path = ''
as $$
declare
  v_orden public.ordenes_servicio;
begin
  if not public.puede_gestionar_operacion() then
    raise exception 'No autorizado para asignar órdenes y configurar garantías'
      using errcode = '42501';
  end if;

  if p_tecnico_id is null or not exists (
    select 1 from public.tecnicos t where t.id = p_tecnico_id and t.activo
  ) then
    raise exception 'El técnico no existe o está inactivo';
  end if;

  if p_tiene_garantia and p_orden_origen_id is null
     and (p_duracion_valor is null or p_duracion_valor <= 0) then
    raise exception 'La duración de la garantía debe ser mayor que cero';
  end if;

  update public.ordenes_servicio
     set tecnico_id = p_tecnico_id,
         estado = 'Asignada',
         historial = coalesce(p_historial, '[]'::jsonb)
   where id = p_orden_id
  returning * into v_orden;

  if not found then
    raise exception 'La orden no existe';
  end if;

  insert into public.orden_garantias (
    orden_id, orden_origen_id, tiene_garantia, duracion_valor, duracion_unidad,
    cobertura, condiciones, resultado
  ) values (
    p_orden_id, p_orden_origen_id, p_tiene_garantia,
    case when p_tiene_garantia then p_duracion_valor end,
    case when p_tiene_garantia then p_duracion_unidad end,
    case when p_tiene_garantia then p_cobertura end,
    case when p_tiene_garantia then p_condiciones end,
    coalesce(p_resultado, 'Pendiente')
  )
  on conflict (orden_id) do update set
    orden_origen_id = excluded.orden_origen_id,
    tiene_garantia  = excluded.tiene_garantia,
    duracion_valor  = excluded.duracion_valor,
    duracion_unidad = excluded.duracion_unidad,
    cobertura       = excluded.cobertura,
    condiciones     = excluded.condiciones,
    resultado       = excluded.resultado;
    -- fecha_inicio, fecha_fin y gastos se conservan: en una atención por
    -- garantía vienen de la orden original (lib/ticket-conversion.ts).

  return v_orden;
end;
$$;

revoke all on function public.asignar_orden_con_garantia_v2(
  uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text
) from public, anon;
grant execute on function public.asignar_orden_con_garantia_v2(
  uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text
) to authenticated;

notify pgrst, 'reload schema';

-- La garantía se activa en la base de datos al cerrar la orden.
-- Esto evita dar permisos de escritura sobre orden_garantias al técnico.

create or replace function public.activar_garantia_al_cerrar_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha_inicio date;
  v_fecha_fin date;
begin
  if new.estado = 'Terminada' and coalesce(old.estado, '') <> 'Terminada' and new.fecha_cierre is not null then
    if exists (
      select 1
      from public.orden_garantias g
      where g.orden_id = new.id
        and g.orden_origen_id is null
        and g.tiene_garantia = true
        and g.fecha_inicio is null
    ) then
      v_fecha_inicio := new.fecha_cierre::date;

      select case g.duracion_unidad
        when 'Días' then v_fecha_inicio + (g.duracion_valor - 1)
        when 'Meses' then (v_fecha_inicio + make_interval(months => g.duracion_valor))::date - 1
        when 'Años' then (v_fecha_inicio + make_interval(months => g.duracion_valor * 12))::date - 1
        else null
      end
      into v_fecha_fin
      from public.orden_garantias g
      where g.orden_id = new.id;

      update public.orden_garantias
      set fecha_inicio = v_fecha_inicio,
          fecha_fin = v_fecha_fin,
          resultado = 'Vigente'
      where orden_id = new.id
        and orden_origen_id is null
        and tiene_garantia = true
        and fecha_inicio is null;
    elsif exists (
      select 1
      from public.orden_garantias g
      where g.orden_id = new.id
        and g.orden_origen_id is null
        and g.tiene_garantia = false
    ) then
      update public.orden_garantias
      set resultado = 'No aplica',
          fecha_inicio = null,
          fecha_fin = null
      where orden_id = new.id
        and orden_origen_id is null
        and tiene_garantia = false;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ordenes_servicio_activar_garantia on public.ordenes_servicio;
create trigger trg_ordenes_servicio_activar_garantia
after update of estado, fecha_cierre on public.ordenes_servicio
for each row
execute function public.activar_garantia_al_cerrar_orden();

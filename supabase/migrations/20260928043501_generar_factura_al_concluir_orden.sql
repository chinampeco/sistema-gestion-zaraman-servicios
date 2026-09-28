create or replace function public.generar_factura_al_concluir_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cotizacion public.cotizaciones%rowtype;
begin
  if new.estado <> 'Terminada' or new.firma_tecnico_at is null or coalesce(new.es_garantia, false) then
    return new;
  end if;

  if exists (select 1 from public.facturas f where f.orden_id = new.id) then
    return new;
  end if;

  select * into v_cotizacion
    from public.cotizaciones c
   where c.orden_id = new.id
     and c.estado = 'Aceptada'
   order by c.aceptada_en desc nulls last, c.created_at desc
   limit 1;

  if not found then
    return new;
  end if;

  insert into public.facturas (
    cliente_id, orden_id, cotizacion_id, conceptos,
    subtotal, descuento, iva, total,
    monto_pagado, saldo, fecha, condiciones, observaciones,
    estado, creado_por
  ) values (
    new.cliente_id, new.id, v_cotizacion.id, v_cotizacion.conceptos,
    v_cotizacion.subtotal, v_cotizacion.descuento, v_cotizacion.iva, v_cotizacion.total,
    0, greatest(v_cotizacion.total, 0), current_date, v_cotizacion.condiciones,
    'Generada automáticamente al concluir la orden ' || new.folio || ' a partir de la cotización aceptada ' || v_cotizacion.folio || '.',
    'Pendiente', coalesce(new.cerrada_por, new.creado_por)
  );

  return new;
end;
$$;

drop trigger if exists trg_generar_factura_al_concluir_orden on public.ordenes_servicio;
create trigger trg_generar_factura_al_concluir_orden
after update of estado, firma_tecnico_at on public.ordenes_servicio
for each row execute function public.generar_factura_al_concluir_orden();

revoke execute on function public.generar_factura_al_concluir_orden() from anon, authenticated;

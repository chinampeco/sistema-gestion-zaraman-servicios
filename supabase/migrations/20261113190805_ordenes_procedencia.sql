-- Base real: ynpvetdujkpxuaplsona.
-- Procedencia de cada orden de servicio: de dónde salió. Se fija al crearla y no cambia.
--   Manual      captura directa en el panel
--   Ticket      conversión de un ticket
--   Cotización  cotización aceptada (panel o portal del cliente)
--   Garantía    atención por garantía de una orden anterior
--   Contrato    generada desde la ficha técnica de un contrato (fases 3 y 4)
--
-- Las órdenes existentes se llenan con la procedencia que ya se puede deducir, sin
-- tocar su fecha de última modificación (se pausa el trigger de updated_at durante
-- el llenado). Aditiva: agrega columna, función y trigger.

alter table public.ordenes_servicio
  add column if not exists procedencia text not null default 'Manual';

alter table public.ordenes_servicio
  add constraint ordenes_servicio_procedencia_check
  check (procedencia in ('Manual', 'Ticket', 'Cotización', 'Garantía', 'Contrato'));

create index if not exists idx_ordenes_servicio_procedencia
  on public.ordenes_servicio (empresa_id, procedencia);

-- Órdenes existentes.
alter table public.ordenes_servicio disable trigger trg_touch_ordenes;

update public.ordenes_servicio o set procedencia = case
  when o.ticket_id is not null then 'Ticket'
  when exists (select 1 from public.cotizaciones c where c.orden_id = o.id) then 'Cotización'
  when o.es_garantia
    or o.orden_origen_id is not null
    or exists (select 1 from public.orden_garantias g
                where g.orden_id = o.id and g.orden_origen_id is not null) then 'Garantía'
  else 'Manual'
end;

alter table public.ordenes_servicio enable trigger trg_touch_ordenes;

-- Órdenes nuevas: si el código no la indica, se deduce de los datos de la orden.
-- La cotización aceptada (panel y portal) y la atención por garantía la mandan
-- explícitamente porque esos vínculos se guardan después de crear la orden.
create or replace function public.asignar_procedencia_orden()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.procedencia := old.procedencia;
    return new;
  end if;

  if new.procedencia is null or new.procedencia = 'Manual' then
    new.procedencia := case
      when new.ticket_id is not null then 'Ticket'
      when new.es_garantia or new.orden_origen_id is not null then 'Garantía'
      else 'Manual'
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.asignar_procedencia_orden() from public, anon, authenticated;

create trigger trg_procedencia_orden
before insert or update on public.ordenes_servicio
for each row execute function public.asignar_procedencia_orden();

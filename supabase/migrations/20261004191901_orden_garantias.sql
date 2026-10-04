-- Base real: ynpvetdujkpxuaplsona.
-- Garantías de órdenes de servicio (una fila por orden).
-- Usado por components/ordenes/garantia-orden.tsx,
-- components/ordenes/pendientes-asignacion.tsx y lib/ticket-conversion.ts.

create table if not exists public.orden_garantias (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null unique references public.ordenes_servicio(id) on delete cascade,
  orden_origen_id uuid null references public.ordenes_servicio(id) on delete set null,
  tiene_garantia boolean not null default false,
  duracion_valor integer null,
  duracion_unidad text null,
  fecha_inicio date null,
  fecha_fin date null,
  cobertura text null,
  condiciones text null,
  resultado text not null default 'Pendiente',
  gastos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orden_garantias_duracion_check check (duracion_valor is null or duracion_valor > 0),
  constraint orden_garantias_unidad_check check (
    duracion_unidad is null or duracion_unidad in ('Días', 'Meses', 'Años')
  ),
  constraint orden_garantias_resultado_check check (
    resultado in ('Pendiente', 'Vigente', 'Vencida', 'Aprobada', 'No aplica', 'Absorbida por ZARAMAN')
  )
);

create index if not exists idx_orden_garantias_origen on public.orden_garantias(orden_origen_id);
create index if not exists idx_orden_garantias_fecha_fin on public.orden_garantias(fecha_fin);

create or replace trigger trg_touch_orden_garantias
before update on public.orden_garantias
for each row execute function public.touch_updated_at();

-- Permisos de tabla: nada para anon; el código solo lee, inserta (upsert) y actualiza.
alter table public.orden_garantias enable row level security;
revoke all on table public.orden_garantias from anon, authenticated;
grant select, insert, update on table public.orden_garantias to authenticated;

-- Lectura: personal interno no técnico (Administrador, Coordinador, Supervisor, Consulta).
create policy orden_garantias_staff_select
on public.orden_garantias for select to authenticated
using (public.is_staff() and not public.is_tecnico());

-- Lectura: el técnico solo ve la garantía de sus propias órdenes.
create policy orden_garantias_tecnico_select
on public.orden_garantias for select to authenticated
using (
  public.is_tecnico()
  and exists (
    select 1
    from public.ordenes_servicio o
    where o.id = orden_garantias.orden_id
      and o.tecnico_id = public.current_tecnico_id()
  )
);

-- Escritura: Administrador, Coordinador y Supervisor activos.
create policy orden_garantias_gestion_insert
on public.orden_garantias for insert to authenticated
with check (public.puede_gestionar_operacion());

create policy orden_garantias_gestion_update
on public.orden_garantias for update to authenticated
using (public.puede_gestionar_operacion())
with check (public.puede_gestionar_operacion());

comment on table public.orden_garantias is
  'Configuración de garantía y trazabilidad de atenciones de garantía de órdenes de servicio.';
comment on column public.orden_garantias.orden_origen_id is
  'Orden original cuando esta fila corresponde a una atención posterior por garantía.';
comment on column public.orden_garantias.gastos is
  'Costos internos de la atención: materiales, traslado, mano de obra y otros gastos operativos.';

-- Activa la garantía al cerrar la orden. Es SECURITY DEFINER porque el técnico
-- cierra la orden pero no tiene permiso de escritura sobre orden_garantias.
create or replace function public.activar_garantia_al_cerrar_orden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha_inicio date;
  v_fecha_fin date;
begin
  if new.estado = 'Terminada'
     and coalesce(old.estado, '') <> 'Terminada'
     and new.fecha_cierre is not null then

    if exists (
      select 1 from public.orden_garantias g
      where g.orden_id = new.id
        and g.orden_origen_id is null
        and g.tiene_garantia = true
        and g.fecha_inicio is null
    ) then
      v_fecha_inicio := new.fecha_cierre::date;

      select case g.duracion_unidad
          when 'Días'  then v_fecha_inicio + (g.duracion_valor - 1)
          when 'Meses' then (v_fecha_inicio + make_interval(months => g.duracion_valor))::date - 1
          when 'Años'  then (v_fecha_inicio + make_interval(years => g.duracion_valor))::date - 1
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
      select 1 from public.orden_garantias g
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

revoke all on function public.activar_garantia_al_cerrar_orden() from public, anon, authenticated;

create or replace trigger trg_ordenes_servicio_activar_garantia
after update of estado, fecha_cierre on public.ordenes_servicio
for each row execute function public.activar_garantia_al_cerrar_orden();

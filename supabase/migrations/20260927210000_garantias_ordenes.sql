-- Garantías de órdenes de servicio ZARAMAN
-- Una fila por orden permite conservar la orden original intacta y enlazar
-- cualquier atención posterior por garantía como una nueva orden.

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

create or replace function public.set_orden_garantias_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orden_garantias_updated_at on public.orden_garantias;
create trigger trg_orden_garantias_updated_at
before update on public.orden_garantias
for each row execute function public.set_orden_garantias_updated_at();

alter table public.orden_garantias enable row level security;

drop policy if exists "orden_garantias_select_authenticated" on public.orden_garantias;
create policy "orden_garantias_select_authenticated"
on public.orden_garantias
for select
to authenticated
using (true);

drop policy if exists "orden_garantias_write_internal" on public.orden_garantias;
create policy "orden_garantias_write_internal"
on public.orden_garantias
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.rol in ('Administrador', 'Coordinador', 'Supervisor', 'Técnico')
      and coalesce(p.activo, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.rol in ('Administrador', 'Coordinador', 'Supervisor', 'Técnico')
      and coalesce(p.activo, true) = true
  )
);

comment on table public.orden_garantias is 'Configuración de garantía y trazabilidad de atenciones de garantía de órdenes de servicio.';
comment on column public.orden_garantias.orden_origen_id is 'Orden original cuando esta fila corresponde a una atención posterior por garantía.';
comment on column public.orden_garantias.gastos is 'Costos internos de la atención: materiales, traslado, mano de obra y otros gastos operativos.';

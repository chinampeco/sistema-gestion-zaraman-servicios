-- Base real: ynpvetdujkpxuaplsona.
-- Columnas que el código de main escribe y que no existen en la base real.
-- Solo se agregan columnas; no se modifican filas existentes (las columnas
-- nuevas toman su valor por defecto).

-- lib/mappers.ts (cotizacionToDb) y app/api/portal/cotizaciones (rechazar).
alter table public.cotizaciones
  add column if not exists motivo_rechazo text;

-- lib/ticket-conversion.ts inserta estas columnas al convertir un ticket en orden.
alter table public.ordenes_servicio
  add column if not exists es_garantia boolean not null default false,
  add column if not exists orden_origen_id uuid references public.ordenes_servicio(id) on delete set null,
  add column if not exists motivo_garantia text,
  add column if not exists garantia_dias integer not null default 0,
  add column if not exists garantia_inicio date,
  add column if not exists garantia_fin date;

create index if not exists idx_ordenes_servicio_orden_origen
  on public.ordenes_servicio(orden_origen_id);

comment on column public.ordenes_servicio.orden_origen_id is
  'Orden original cuando esta orden es una atención por garantía.';

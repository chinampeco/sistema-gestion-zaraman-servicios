create sequence if not exists public.cotizacion_seq;

create table if not exists public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  folio text not null default ('COT-' || lpad(nextval('public.cotizacion_seq')::text, 6, '0')),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  equipo_id uuid references public.equipos(id) on delete set null,
  contacto text not null default '',
  conceptos jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  descuento numeric(14,2) not null default 0 check (descuento >= 0),
  iva numeric(14,2) not null default 0 check (iva >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  vigencia date,
  condiciones text not null default '',
  observaciones text not null default '',
  estado text not null default 'Enviada' check (estado in ('Enviada','Vista','Aceptada','Rechazada','Vencida')),
  orden_id uuid references public.ordenes_servicio(id) on delete set null,
  lead_id uuid,
  aceptada_en timestamptz,
  aceptada_por uuid,
  rechazada_en timestamptz,
  rechazada_por uuid,
  motivo_rechazo text,
  historial jsonb not null default '[]'::jsonb,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists cotizaciones_folio_unique on public.cotizaciones(folio);
create unique index if not exists cotizaciones_orden_unique on public.cotizaciones(orden_id) where orden_id is not null;
create index if not exists cotizaciones_cliente_idx on public.cotizaciones(cliente_id);
create index if not exists cotizaciones_estado_idx on public.cotizaciones(estado);

alter table public.cotizaciones enable row level security;
drop policy if exists "usuarios autenticados pueden ver cotizaciones" on public.cotizaciones;
drop policy if exists "usuarios autenticados pueden crear cotizaciones" on public.cotizaciones;
drop policy if exists "usuarios autenticados pueden actualizar cotizaciones" on public.cotizaciones;
drop policy if exists "usuarios autenticados pueden eliminar cotizaciones" on public.cotizaciones;
create policy "usuarios autenticados pueden ver cotizaciones" on public.cotizaciones for select to authenticated using (true);
create policy "usuarios autenticados pueden crear cotizaciones" on public.cotizaciones for insert to authenticated with check (true);
create policy "usuarios autenticados pueden actualizar cotizaciones" on public.cotizaciones for update to authenticated using (true) with check (true);
create policy "usuarios autenticados pueden eliminar cotizaciones" on public.cotizaciones for delete to authenticated using (true);
grant select, insert, update, delete on public.cotizaciones to authenticated;

alter table public.facturas add constraint facturas_cotizacion_id_fkey foreign key (cotizacion_id) references public.cotizaciones(id) on delete set null;
create unique index if not exists facturas_orden_unique on public.facturas(orden_id) where orden_id is not null;

create sequence if not exists public.factura_seq;
create sequence if not exists public.pago_seq;

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  folio text not null default ('FAC-' || lpad(nextval('public.factura_seq')::text, 6, '0')),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  orden_id uuid references public.ordenes_servicio(id) on delete set null,
  cotizacion_id uuid,
  conceptos jsonb not null default '[]'::jsonb,
  subtotal numeric(14,2) not null default 0,
  descuento numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  monto_pagado numeric(14,2) not null default 0,
  saldo numeric(14,2) not null default 0,
  fecha date default current_date,
  fecha_vencimiento date,
  condiciones text,
  observaciones text,
  estado text not null default 'Pendiente' check (estado in ('Pendiente','Emitida','Pagada','Parcialmente pagada','Cancelada')),
  creado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  uuid_cfdi uuid,
  fecha_timbrado timestamptz,
  metodo_pago_sat text,
  forma_pago_sat text,
  uso_cfdi text,
  serie_cfdi text,
  folio_cfdi text,
  xml_url text,
  pdf_url text,
  cancelada_at timestamptz,
  cancelada_motivo text,
  constraint facturas_folio_unique unique (folio),
  constraint facturas_montos_nonnegative check (subtotal >= 0 and descuento >= 0 and iva >= 0 and total >= 0 and monto_pagado >= 0),
  constraint facturas_saldo_nonnegative check (saldo >= 0)
);

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  folio text not null default ('PAG-' || lpad(nextval('public.pago_seq')::text, 6, '0')),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  monto numeric(14,2) not null check (monto > 0),
  metodo text not null default 'Efectivo' check (metodo in ('Efectivo','Transferencia','Cheque','Tarjeta de crédito','Tarjeta de débito','Otro')),
  referencia text,
  fecha date not null default current_date,
  observaciones text,
  creado_por uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists pagos_folio_unique on public.pagos(folio);
create index if not exists facturas_cliente_idx on public.facturas(cliente_id);
create index if not exists facturas_orden_idx on public.facturas(orden_id);
create index if not exists facturas_estado_idx on public.facturas(estado);
create index if not exists facturas_vencimiento_idx on public.facturas(fecha_vencimiento);
create index if not exists pagos_factura_idx on public.pagos(factura_id);
create index if not exists pagos_cliente_idx on public.pagos(cliente_id);
create index if not exists pagos_fecha_idx on public.pagos(fecha);

create or replace function public.recalcular_factura_pago(p_factura_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(14,2);
  v_pagado numeric(14,2);
  v_saldo numeric(14,2);
  v_estado text;
begin
  select total into v_total from public.facturas where id = p_factura_id for update;
  if not found then return; end if;

  select coalesce(sum(monto), 0)::numeric(14,2)
    into v_pagado
    from public.pagos
   where factura_id = p_factura_id;

  v_saldo := greatest(v_total - v_pagado, 0);

  select case
    when estado = 'Cancelada' then 'Cancelada'
    when v_total <= 0 then 'Pendiente'
    when v_pagado >= v_total then 'Pagada'
    when v_pagado > 0 then 'Parcialmente pagada'
    when estado = 'Emitida' then 'Emitida'
    else 'Pendiente'
  end into v_estado
  from public.facturas where id = p_factura_id;

  update public.facturas
     set monto_pagado = v_pagado,
         saldo = v_saldo,
         estado = v_estado,
         updated_at = now()
   where id = p_factura_id;
end;
$$;

create or replace function public.trg_factura_inicializar_saldo()
returns trigger
language plpgsql
as $$
begin
  if new.monto_pagado is null then new.monto_pagado := 0; end if;
  new.saldo := greatest(coalesce(new.total,0) - new.monto_pagado, 0);
  if new.estado is null then new.estado := 'Pendiente'; end if;
  return new;
end;
$$;

drop trigger if exists trg_factura_inicializar_saldo on public.facturas;
create trigger trg_factura_inicializar_saldo
before insert or update of total, monto_pagado, estado on public.facturas
for each row execute function public.trg_factura_inicializar_saldo();

create or replace function public.trg_recalcular_factura_desde_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_factura_pago(old.factura_id);
    return old;
  else
    perform public.recalcular_factura_pago(new.factura_id);
    if tg_op = 'UPDATE' and old.factura_id <> new.factura_id then
      perform public.recalcular_factura_pago(old.factura_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_recalcular_factura_desde_pago on public.pagos;
create trigger trg_recalcular_factura_desde_pago
after insert or update or delete on public.pagos
for each row execute function public.trg_recalcular_factura_desde_pago();

create or replace function public.trg_validar_pago_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente uuid;
  v_saldo numeric(14,2);
  v_estado text;
begin
  select cliente_id, saldo, estado into v_cliente, v_saldo, v_estado
    from public.facturas where id = new.factura_id;
  if not found then
    raise exception 'La factura no existe.';
  end if;
  if v_estado = 'Cancelada' then
    raise exception 'No se puede registrar un pago en una factura cancelada.';
  end if;
  if v_cliente <> new.cliente_id then
    raise exception 'El cliente del pago no corresponde a la factura.';
  end if;
  if new.monto > v_saldo then
    raise exception 'El pago (%s) excede el saldo de la factura (%s).', new.monto, v_saldo;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_pago_factura on public.pagos;
create trigger trg_validar_pago_factura
before insert on public.pagos
for each row execute function public.trg_validar_pago_factura();

alter table public.facturas enable row level security;
alter table public.pagos enable row level security;

drop policy if exists "usuarios autenticados pueden ver facturas" on public.facturas;
drop policy if exists "usuarios autenticados pueden crear facturas" on public.facturas;
drop policy if exists "usuarios autenticados pueden actualizar facturas" on public.facturas;
drop policy if exists "usuarios autenticados pueden eliminar facturas" on public.facturas;
create policy "usuarios autenticados pueden ver facturas" on public.facturas for select to authenticated using (true);
create policy "usuarios autenticados pueden crear facturas" on public.facturas for insert to authenticated with check (true);
create policy "usuarios autenticados pueden actualizar facturas" on public.facturas for update to authenticated using (true) with check (true);
create policy "usuarios autenticados pueden eliminar facturas" on public.facturas for delete to authenticated using (true);

drop policy if exists "usuarios autenticados pueden ver pagos" on public.pagos;
drop policy if exists "usuarios autenticados pueden crear pagos" on public.pagos;
drop policy if exists "usuarios autenticados pueden actualizar pagos" on public.pagos;
drop policy if exists "usuarios autenticados pueden eliminar pagos" on public.pagos;
create policy "usuarios autenticados pueden ver pagos" on public.pagos for select to authenticated using (true);
create policy "usuarios autenticados pueden crear pagos" on public.pagos for insert to authenticated with check (true);
create policy "usuarios autenticados pueden actualizar pagos" on public.pagos for update to authenticated using (true) with check (true);
create policy "usuarios autenticados pueden eliminar pagos" on public.pagos for delete to authenticated using (true);

grant select, insert, update, delete on public.facturas to authenticated;
grant select, insert, update, delete on public.pagos to authenticated;

update public.facturas f
set monto_pagado = coalesce((select sum(p.monto) from public.pagos p where p.factura_id = f.id),0),
    saldo = greatest(f.total - coalesce((select sum(p.monto) from public.pagos p where p.factura_id = f.id),0),0),
    updated_at = now();

update public.facturas f
set estado = case
  when f.estado = 'Cancelada' then 'Cancelada'
  when f.total <= 0 then 'Pendiente'
  when f.monto_pagado >= f.total then 'Pagada'
  when f.monto_pagado > 0 then 'Parcialmente pagada'
  when f.estado = 'Emitida' then 'Emitida'
  else 'Pendiente'
end;
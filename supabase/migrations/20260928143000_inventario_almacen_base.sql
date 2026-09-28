create table if not exists public.inventario_productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  categoria text not null default 'General',
  marca text,
  modelo text,
  unidad text not null default 'Pieza',
  costo numeric(14,2) not null default 0 check (costo >= 0),
  precio_venta numeric(14,2) not null default 0 check (precio_venta >= 0),
  stock numeric(14,3) not null default 0 check (stock >= 0),
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  ubicacion text,
  activo boolean not null default true,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.inventario_productos(id) on delete restrict,
  tipo text not null check (tipo in ('Entrada','Salida','Ajuste','Devolución','Consumo de servicio')),
  cantidad numeric(14,3) not null,
  stock_anterior numeric(14,3) not null default 0,
  stock_nuevo numeric(14,3) not null default 0,
  costo_unitario numeric(14,2) not null default 0 check (costo_unitario >= 0),
  referencia text,
  orden_id uuid references public.ordenes_servicio(id) on delete set null,
  notas text,
  creado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint inventario_movimientos_cantidad_ck check (
    (tipo = 'Ajuste' and cantidad >= 0)
    or (tipo <> 'Ajuste' and cantidad > 0)
  )
);

create index if not exists idx_inventario_productos_categoria on public.inventario_productos(categoria);
create index if not exists idx_inventario_productos_activo on public.inventario_productos(activo);
create index if not exists idx_inventario_movimientos_producto on public.inventario_movimientos(producto_id, created_at desc);
create index if not exists idx_inventario_movimientos_orden on public.inventario_movimientos(orden_id);

create or replace function public.inventario_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_inventario_productos_updated_at on public.inventario_productos;
create trigger trg_inventario_productos_updated_at
before update on public.inventario_productos
for each row execute function public.inventario_set_updated_at();

create or replace function public.aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock numeric(14,3);
  v_nuevo numeric(14,3);
begin
  select stock into v_stock
  from public.inventario_productos
  where id = new.producto_id
  for update;

  if v_stock is null then
    raise exception 'Producto de inventario no encontrado';
  end if;

  if new.tipo = 'Ajuste' then
    v_nuevo := new.cantidad;
  elsif new.tipo in ('Entrada','Devolución') then
    v_nuevo := v_stock + new.cantidad;
  else
    v_nuevo := v_stock - new.cantidad;
    if v_nuevo < 0 then
      raise exception 'Stock insuficiente. Disponible: %, solicitado: %', v_stock, new.cantidad;
    end if;
  end if;

  new.stock_anterior := v_stock;
  new.stock_nuevo := v_nuevo;

  update public.inventario_productos
     set stock = v_nuevo,
         updated_at = now()
   where id = new.producto_id;

  return new;
end;
$$;

drop trigger if exists trg_aplicar_movimiento_inventario on public.inventario_movimientos;
create trigger trg_aplicar_movimiento_inventario
before insert on public.inventario_movimientos
for each row execute function public.aplicar_movimiento_inventario();

alter table public.inventario_productos enable row level security;
alter table public.inventario_movimientos enable row level security;

drop policy if exists "inventario_productos_select_interno" on public.inventario_productos;
create policy "inventario_productos_select_interno"
on public.inventario_productos for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('administrador','coordinador','supervisor','tecnico','consulta'))
);

drop policy if exists "inventario_productos_write_supervision" on public.inventario_productos;
create policy "inventario_productos_write_supervision"
on public.inventario_productos for all to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('administrador','coordinador','supervisor'))
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('administrador','coordinador','supervisor'))
);

drop policy if exists "inventario_movimientos_select_interno" on public.inventario_movimientos;
create policy "inventario_movimientos_select_interno"
on public.inventario_movimientos for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('administrador','coordinador','supervisor','tecnico','consulta'))
);

drop policy if exists "inventario_movimientos_write_supervision" on public.inventario_movimientos;
create policy "inventario_movimientos_write_supervision"
on public.inventario_movimientos for insert to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role in ('administrador','coordinador','supervisor'))
);

revoke update, delete on public.inventario_movimientos from authenticated;

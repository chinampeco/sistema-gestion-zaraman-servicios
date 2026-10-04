-- Base real: ynpvetdujkpxuaplsona.
-- Inventario con varios almacenes, tal como lo usa app/(app)/inventario/page.tsx.
-- El stock solo cambia mediante inventario_movimientos (trigger); el código no
-- puede escribir stock directamente.

create table if not exists public.almacenes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  ubicacion text,
  responsable_id uuid references public.profiles(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventario_existencias (
  producto_id uuid not null references public.inventario_productos(id) on delete restrict,
  almacen_id uuid not null references public.almacenes(id) on delete restrict,
  stock numeric(14,3) not null default 0 check (stock >= 0),
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  updated_at timestamptz not null default now(),
  primary key (producto_id, almacen_id)
);

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.inventario_productos(id) on delete restrict,
  tipo text not null,
  cantidad numeric(14,3) not null,
  stock_anterior numeric(14,3) not null default 0,
  stock_nuevo numeric(14,3) not null default 0,
  costo_unitario numeric(14,2) not null default 0 check (costo_unitario >= 0),
  referencia text,
  orden_id uuid references public.ordenes_servicio(id) on delete set null,
  notas text,
  almacen_id uuid references public.almacenes(id) on delete restrict,
  almacen_destino_id uuid references public.almacenes(id) on delete restrict,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventario_movimientos_tipo_ck check (
    tipo in ('Entrada', 'Salida', 'Ajuste', 'Devolución', 'Consumo de servicio', 'Transferencia')
  ),
  constraint inventario_movimientos_cantidad_ck check (
    (tipo = 'Ajuste' and cantidad >= 0) or (tipo <> 'Ajuste' and cantidad > 0)
  )
);

create index if not exists idx_inventario_productos_categoria on public.inventario_productos(categoria);
create index if not exists idx_inventario_productos_activo on public.inventario_productos(activo);
create index if not exists idx_inventario_existencias_almacen on public.inventario_existencias(almacen_id);
create index if not exists idx_inventario_movimientos_producto on public.inventario_movimientos(producto_id, created_at desc);
create index if not exists idx_inventario_movimientos_almacen on public.inventario_movimientos(almacen_id, created_at desc);
create index if not exists idx_inventario_movimientos_orden on public.inventario_movimientos(orden_id);

create or replace trigger trg_touch_almacenes
before update on public.almacenes
for each row execute function public.touch_updated_at();

create or replace trigger trg_touch_inventario_productos
before update on public.inventario_productos
for each row execute function public.touch_updated_at();

create or replace trigger trg_touch_inventario_existencias
before update on public.inventario_existencias
for each row execute function public.touch_updated_at();

-- Aplica cada movimiento al stock por almacén y al stock global del producto.
-- Es SECURITY DEFINER porque authenticated no tiene permiso para escribir stock.
create or replace function public.aplicar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global numeric(14,3);
  v_local numeric(14,3);
  v_nuevo_local numeric(14,3);
  v_delta numeric(14,3);
begin
  select stock into v_global
    from public.inventario_productos
   where id = new.producto_id
   for update;
  if v_global is null then
    raise exception 'Producto de inventario no encontrado';
  end if;

  if new.tipo = 'Transferencia' then
    if new.almacen_id is null or new.almacen_destino_id is null
       or new.almacen_id = new.almacen_destino_id then
      raise exception 'Una transferencia requiere almacén origen y destino diferentes';
    end if;

    insert into public.inventario_existencias (producto_id, almacen_id)
    values (new.producto_id, new.almacen_id), (new.producto_id, new.almacen_destino_id)
    on conflict do nothing;

    select stock into v_local
      from public.inventario_existencias
     where producto_id = new.producto_id and almacen_id = new.almacen_id
     for update;
    if v_local < new.cantidad then
      raise exception 'Stock insuficiente en almacén origen. Disponible: %, solicitado: %', v_local, new.cantidad;
    end if;

    update public.inventario_existencias set stock = stock - new.cantidad
     where producto_id = new.producto_id and almacen_id = new.almacen_id;
    update public.inventario_existencias set stock = stock + new.cantidad
     where producto_id = new.producto_id and almacen_id = new.almacen_destino_id;

    new.stock_anterior := v_global;
    new.stock_nuevo := v_global;
    return new;
  end if;

  if new.almacen_id is not null then
    insert into public.inventario_existencias (producto_id, almacen_id)
    values (new.producto_id, new.almacen_id)
    on conflict do nothing;

    select stock into v_local
      from public.inventario_existencias
     where producto_id = new.producto_id and almacen_id = new.almacen_id
     for update;
  else
    v_local := v_global;
  end if;

  if new.tipo = 'Ajuste' then
    v_nuevo_local := new.cantidad;
    v_delta := v_nuevo_local - v_local;
  elsif new.tipo in ('Entrada', 'Devolución') then
    v_nuevo_local := v_local + new.cantidad;
    v_delta := new.cantidad;
  else
    v_nuevo_local := v_local - new.cantidad;
    v_delta := -new.cantidad;
    if v_nuevo_local < 0 then
      raise exception 'Stock insuficiente. Disponible: %, solicitado: %', v_local, new.cantidad;
    end if;
  end if;

  new.stock_anterior := v_global;

  if new.almacen_id is not null then
    update public.inventario_existencias set stock = v_nuevo_local
     where producto_id = new.producto_id and almacen_id = new.almacen_id;
    update public.inventario_productos set stock = stock + v_delta
     where id = new.producto_id;
  else
    update public.inventario_productos set stock = v_nuevo_local
     where id = new.producto_id;
  end if;

  select stock into new.stock_nuevo
    from public.inventario_productos
   where id = new.producto_id;

  return new;
end;
$$;

revoke all on function public.aplicar_movimiento_inventario() from public, anon, authenticated;

create or replace trigger trg_aplicar_movimiento_inventario
before insert on public.inventario_movimientos
for each row execute function public.aplicar_movimiento_inventario();

-- RLS y permisos de tabla -------------------------------------------------

alter table public.almacenes enable row level security;
alter table public.inventario_productos enable row level security;
alter table public.inventario_existencias enable row level security;
alter table public.inventario_movimientos enable row level security;

revoke all on table public.almacenes, public.inventario_productos,
  public.inventario_existencias, public.inventario_movimientos
  from anon, authenticated;

grant select, insert, update on table public.almacenes to authenticated;
grant select on table public.inventario_productos to authenticated;
grant insert (codigo, nombre, descripcion, categoria, marca, modelo, unidad, costo,
              precio_venta, stock_minimo, ubicacion, activo, creado_por)
  on table public.inventario_productos to authenticated;
grant update (codigo, nombre, descripcion, categoria, marca, modelo, unidad, costo,
              precio_venta, stock_minimo, ubicacion, activo)
  on table public.inventario_productos to authenticated;
grant select on table public.inventario_existencias to authenticated;
grant select, insert on table public.inventario_movimientos to authenticated;

-- Lectura: personal interno no técnico (el módulo de inventario no es visible para Técnico).
create policy almacenes_staff_select on public.almacenes
  for select to authenticated using (public.is_staff() and not public.is_tecnico());
create policy inventario_productos_staff_select on public.inventario_productos
  for select to authenticated using (public.is_staff() and not public.is_tecnico());
create policy inventario_existencias_staff_select on public.inventario_existencias
  for select to authenticated using (public.is_staff() and not public.is_tecnico());
create policy inventario_movimientos_staff_select on public.inventario_movimientos
  for select to authenticated using (public.is_staff() and not public.is_tecnico());

-- Escritura: Administrador, Coordinador y Supervisor activos.
create policy almacenes_gestion_insert on public.almacenes
  for insert to authenticated with check (public.puede_gestionar_operacion());
create policy almacenes_gestion_update on public.almacenes
  for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());

create policy inventario_productos_gestion_insert on public.inventario_productos
  for insert to authenticated with check (public.puede_gestionar_operacion());
create policy inventario_productos_gestion_update on public.inventario_productos
  for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());

-- Los movimientos se registran a nombre del usuario que los crea y no se editan ni se borran.
create policy inventario_movimientos_gestion_insert on public.inventario_movimientos
  for insert to authenticated
  with check (public.puede_gestionar_operacion() and creado_por = auth.uid());

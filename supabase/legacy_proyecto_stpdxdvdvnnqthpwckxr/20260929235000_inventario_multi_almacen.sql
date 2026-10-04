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

create table if not exists public.inventario_existencias (
  producto_id uuid not null references public.inventario_productos(id) on delete restrict,
  almacen_id uuid not null references public.almacenes(id) on delete restrict,
  stock numeric(14,3) not null default 0 check (stock >= 0),
  stock_minimo numeric(14,3) not null default 0 check (stock_minimo >= 0),
  updated_at timestamptz not null default now(),
  primary key (producto_id, almacen_id)
);

alter table public.inventario_movimientos
  add column if not exists almacen_id uuid references public.almacenes(id) on delete restrict,
  add column if not exists almacen_destino_id uuid references public.almacenes(id) on delete restrict;

alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_tipo_ck;
alter table public.inventario_movimientos drop constraint if exists inventario_movimientos_tipo_check;
alter table public.inventario_movimientos add constraint inventario_movimientos_tipo_ck check (tipo in ('Entrada','Salida','Ajuste','Devolución','Consumo de servicio','Transferencia'));

create index if not exists idx_inventario_existencias_almacen on public.inventario_existencias(almacen_id);
create index if not exists idx_inventario_movimientos_almacen on public.inventario_movimientos(almacen_id, created_at desc);

create or replace function public.almacen_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_almacenes_updated_at on public.almacenes;
create trigger trg_almacenes_updated_at before update on public.almacenes for each row execute function public.almacen_set_updated_at();

drop trigger if exists trg_inventario_existencias_updated_at on public.inventario_existencias;
create trigger trg_inventario_existencias_updated_at before update on public.inventario_existencias for each row execute function public.almacen_set_updated_at();

create or replace function public.aplicar_movimiento_inventario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_global numeric(14,3);
  v_local numeric(14,3);
  v_nuevo_local numeric(14,3);
  v_delta numeric(14,3);
begin
  if new.tipo = 'Transferencia' then
    if new.almacen_id is null or new.almacen_destino_id is null or new.almacen_id = new.almacen_destino_id then
      raise exception 'Una transferencia requiere almacén origen y destino diferentes';
    end if;
    insert into public.inventario_existencias(producto_id, almacen_id)
      values (new.producto_id,new.almacen_id),(new.producto_id,new.almacen_destino_id)
      on conflict do nothing;
    select stock into v_local from public.inventario_existencias
      where producto_id=new.producto_id and almacen_id=new.almacen_id for update;
    if v_local < new.cantidad then
      raise exception 'Stock insuficiente en almacén origen. Disponible: %, solicitado: %',v_local,new.cantidad;
    end if;
    update public.inventario_existencias set stock=stock-new.cantidad
      where producto_id=new.producto_id and almacen_id=new.almacen_id;
    update public.inventario_existencias set stock=stock+new.cantidad
      where producto_id=new.producto_id and almacen_id=new.almacen_destino_id;
    select stock into v_global from public.inventario_productos where id=new.producto_id for update;
    new.stock_anterior:=v_global;
    new.stock_nuevo:=v_global;
    return new;
  end if;

  select stock into v_global from public.inventario_productos where id=new.producto_id for update;
  if v_global is null then raise exception 'Producto de inventario no encontrado'; end if;

  if new.almacen_id is not null then
    insert into public.inventario_existencias(producto_id,almacen_id)
      values(new.producto_id,new.almacen_id) on conflict do nothing;
    select stock into v_local from public.inventario_existencias
      where producto_id=new.producto_id and almacen_id=new.almacen_id for update;
  else
    v_local:=v_global;
  end if;

  if new.tipo='Ajuste' then
    v_nuevo_local:=new.cantidad;
    v_delta:=v_nuevo_local-v_local;
  elsif new.tipo in ('Entrada','Devolución') then
    v_nuevo_local:=v_local+new.cantidad;
    v_delta:=new.cantidad;
  else
    v_nuevo_local:=v_local-new.cantidad;
    v_delta:=-new.cantidad;
    if v_nuevo_local<0 then
      raise exception 'Stock insuficiente. Disponible: %, solicitado: %',v_local,new.cantidad;
    end if;
  end if;

  new.stock_anterior:=v_global;
  if new.almacen_id is not null then
    update public.inventario_existencias set stock=v_nuevo_local
      where producto_id=new.producto_id and almacen_id=new.almacen_id;
    update public.inventario_productos set stock=stock+v_delta,updated_at=now() where id=new.producto_id;
  else
    update public.inventario_productos set stock=v_nuevo_local,updated_at=now() where id=new.producto_id;
  end if;
  select stock into new.stock_nuevo from public.inventario_productos where id=new.producto_id;
  return new;
end; $$;

drop trigger if exists trg_aplicar_movimiento_inventario on public.inventario_movimientos;
create trigger trg_aplicar_movimiento_inventario before insert on public.inventario_movimientos
for each row execute function public.aplicar_movimiento_inventario();

alter table public.almacenes enable row level security;
alter table public.inventario_existencias enable row level security;

drop policy if exists almacenes_select_interno on public.almacenes;
create policy almacenes_select_interno on public.almacenes for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor','tecnico','consulta')));
drop policy if exists almacenes_write_supervision on public.almacenes;
create policy almacenes_write_supervision on public.almacenes for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor')));
drop policy if exists existencias_select_interno on public.inventario_existencias;
create policy existencias_select_interno on public.inventario_existencias for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor','tecnico','consulta')));
drop policy if exists existencias_write_supervision on public.inventario_existencias;
create policy existencias_write_supervision on public.inventario_existencias for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('administrador','coordinador','supervisor')));

revoke update, delete on public.inventario_existencias from authenticated;

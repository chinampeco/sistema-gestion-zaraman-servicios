-- Base real: ynpvetdujkpxuaplsona.
-- FASE 1: MULTIEMPRESA
--
-- Modelo:
--   * empresas: cada razón social que opera en el sistema (ZARAMAN, BOCAM, TOLTECATL, ...).
--   * usuario_empresas: a qué empresas puede entrar cada usuario interno.
--   * profiles.empresa_activa_id: la empresa elegida en el selector del login.
--   * Cada tabla de negocio tiene empresa_id. Una política RLS RESTRICTIVA por tabla
--     solo deja ver y escribir filas de la empresa activa (y solo si el usuario
--     pertenece a ella). Las políticas existentes NO se modifican: se suman.
--   * Un trigger asigna empresa_id al crear: la del registro padre (la orden toma la
--     de su cliente, el pago la de su factura...) o, si no tiene padre, la empresa
--     activa del usuario. Impide mezclar empresas y cambiar la empresa de un registro.
--   * Los clientes del portal no eligen empresa: usan la de su ficha de cliente.
--
-- Compatibilidad: todos los datos actuales y todos los usuarios internos actuales
-- quedan en ZARAMAN con ZARAMAN como empresa activa, así que la app actual sigue
-- funcionando igual antes de publicar el selector.
--
-- Se aplica como una sola transacción (apply_migration / psql --single-transaction).
--
-- Cambios NO aditivos (aprobados por separado):
--   (a) UPDATE de todas las filas existentes para llenar empresa_id = ZARAMAN.
--   (b) Los códigos de almacén y de producto pasan de únicos globales a únicos por empresa
--       (DROP CONSTRAINT + nuevo índice único).
--   (c) asignar_orden_con_garantia_v2 se reemplaza para validar la empresa.
--   (d) Folios separados por empresa: los triggers de folio se reemplazan. ZARAMAN
--       conserva su formato y numeración (OS-000010...); las demás usan su prefijo
--       (BOC-OS-000001, TOL-COT-000001...). Las secuencias anteriores quedan sin uso.

-- 1. Empresas -----------------------------------------------------------------

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique check (clave ~ '^[A-Z0-9_-]{2,20}$'),
  nombre_comercial text not null,
  razon_social text not null,
  rfc text,
  logo_path text,
  -- Prefijo de folios de la empresa (BOC -> BOC-OS-000001). ZARAMAN no lleva prefijo
  -- para conservar su numeración actual (OS-000010, COT-000005...).
  prefijo_folio text unique check (prefijo_folio ~ '^[A-Z0-9]{2,6}$'),
  -- Respaldo solo para procesos del servidor sin usuario (p. ej. webhooks) cuando
  -- el registro no tiene un padre del cual tomar la empresa.
  es_predeterminada boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index empresas_una_predeterminada on public.empresas (es_predeterminada) where es_predeterminada;

create trigger trg_touch_empresas before update on public.empresas
  for each row execute function public.touch_updated_at();

insert into public.empresas (clave, nombre_comercial, razon_social, rfc, prefijo_folio, es_predeterminada) values
  ('ZARAMAN',   'ZARAMAN',   'ZARAMAN S.A. de C.V.', 'ZAR241003615', null, true),
  ('BOCAM',     'BOCAM',     'CONSTRUCTORA E INMOBILIARIA BOCAM S.A. de C.V.', null, 'BOC', false),
  ('TOLTECATL', 'TOLTECATL', 'INGENIERÍA Y MANTENIMIENTO INDUSTRIAL TOLTECATL S.A. de C.V.', null, 'TOL', false);

-- 2. Pertenencia de usuarios a empresas ----------------------------------------

create table public.usuario_empresas (
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (usuario_id, empresa_id)
);
create index idx_usuario_empresas_empresa on public.usuario_empresas (empresa_id);

alter table public.profiles
  add column empresa_activa_id uuid references public.empresas(id) on delete set null;

-- 3. Columna empresa_id en las tablas de negocio --------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','equipos','ordenes_servicio','tickets','cotizaciones','facturas','pagos',
    'tecnicos','leads','lead_actividades','marketing_campanas','whatsapp_mensajes',
    'orden_garantias','almacenes','inventario_productos','inventario_existencias',
    'inventario_movimientos'
  ] loop
    execute format('alter table public.%I add column empresa_id uuid references public.empresas(id) on delete restrict', t);
    execute format('create index idx_%s_empresa on public.%I (empresa_id)', t, t);
  end loop;
end $$;

-- 4. Datos actuales -> ZARAMAN (cambio (a)) ------------------------------------

do $$
declare
  t text;
  v_zaraman uuid := (select id from public.empresas where clave = 'ZARAMAN');
begin
  foreach t in array array[
    'clientes','equipos','ordenes_servicio','tickets','cotizaciones','facturas','pagos',
    'tecnicos','leads','lead_actividades','marketing_campanas','whatsapp_mensajes',
    'orden_garantias','almacenes','inventario_productos','inventario_existencias',
    'inventario_movimientos'
  ] loop
    execute format('update public.%I set empresa_id = $1 where empresa_id is null', t) using v_zaraman;
    execute format('alter table public.%I alter column empresa_id set not null', t);
  end loop;

  -- Todo el personal interno actual entra a ZARAMAN.
  insert into public.usuario_empresas (usuario_id, empresa_id)
  select p.id, v_zaraman from public.profiles p where p.rol <> 'Cliente'
  on conflict do nothing;

  -- Los administradores entran a todas las empresas para poder configurarlas.
  insert into public.usuario_empresas (usuario_id, empresa_id)
  select p.id, e.id from public.profiles p cross join public.empresas e
  where p.rol = 'Administrador'
  on conflict do nothing;

  update public.profiles set empresa_activa_id = v_zaraman
  where rol <> 'Cliente' and empresa_activa_id is null;
end $$;

-- 5. Funciones de empresa -------------------------------------------------------

-- Empresas a las que puede entrar el usuario actual (activas).
create or replace function public.empresas_del_usuario()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select ue.empresa_id
    from public.usuario_empresas ue
    join public.empresas e on e.id = ue.empresa_id
   where ue.usuario_id = auth.uid() and ue.activo and e.activa
  union
  -- Un cliente del portal pertenece a la empresa de su ficha de cliente.
  select c.empresa_id
    from public.profiles p
    join public.clientes c on c.id = p.cliente_id
    join public.empresas e on e.id = c.empresa_id
   where p.id = auth.uid() and p.rol = 'Cliente' and e.activa
$$;

-- Empresa con la que trabaja el usuario actual; null si no eligió una válida.
create or replace function public.empresa_activa()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select case
           when p.rol = 'Cliente' then (
             select c.empresa_id from public.clientes c
              join public.empresas e on e.id = c.empresa_id and e.activa
             where c.id = p.cliente_id)
           when p.empresa_activa_id in (select public.empresas_del_usuario()) then p.empresa_activa_id
         end
    from public.profiles p
   where p.id = auth.uid()
$$;

-- Cambia la empresa activa (selector del login y del encabezado).
create or replace function public.seleccionar_empresa(p_empresa_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  if p_empresa_id is null or p_empresa_id not in (select public.empresas_del_usuario()) then
    raise exception 'No tienes acceso a esa empresa' using errcode = '42501';
  end if;
  update public.profiles set empresa_activa_id = p_empresa_id where id = auth.uid();
  return p_empresa_id;
end;
$$;

-- Usuarios internos de la empresa activa (para la política de perfiles; lee
-- usuario_empresas sin pasar por su RLS, que solo deja ver las membresías propias).
create or replace function public.usuarios_de_empresa_activa()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select ue.usuario_id from public.usuario_empresas ue
   where ue.activo and ue.empresa_id = public.empresa_activa()
$$;

-- Empresa del registro padre (para heredar y validar).
create or replace function public.empresa_de(p_tabla text, p_id uuid)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v uuid;
begin
  if p_id is null then return null; end if;
  execute format('select empresa_id from public.%I where id = $1', p_tabla) into v using p_id;
  return v;
end;
$$;

-- Trigger: asigna y valida empresa_id.
create or replace function public.asignar_empresa()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb := to_jsonb(new);
  v_padre uuid;
begin
  if tg_op = 'UPDATE' and new.empresa_id is distinct from old.empresa_id then
    raise exception 'No se puede cambiar la empresa de un registro existente';
  end if;

  v_padre := case tg_table_name
    when 'equipos'                then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'ordenes_servicio'       then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'tickets'                then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'cotizaciones'           then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'facturas'               then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'leads'                  then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'pagos'                  then coalesce(public.empresa_de('facturas', (r->>'factura_id')::uuid),
                                                public.empresa_de('clientes', (r->>'cliente_id')::uuid))
    when 'whatsapp_mensajes'      then coalesce(public.empresa_de('clientes', (r->>'cliente_id')::uuid),
                                                public.empresa_de('leads', (r->>'lead_id')::uuid))
    when 'lead_actividades'       then public.empresa_de('leads', (r->>'lead_id')::uuid)
    when 'orden_garantias'        then public.empresa_de('ordenes_servicio', (r->>'orden_id')::uuid)
    when 'inventario_existencias' then public.empresa_de('inventario_productos', (r->>'producto_id')::uuid)
    when 'inventario_movimientos' then public.empresa_de('inventario_productos', (r->>'producto_id')::uuid)
    else null
  end;

  if v_padre is not null then
    if new.empresa_id is null then
      new.empresa_id := v_padre;
    elsif new.empresa_id <> v_padre then
      raise exception 'El registro y su registro relacionado pertenecen a empresas distintas';
    end if;
  end if;

  if new.empresa_id is null then
    new.empresa_id := public.empresa_activa();
  end if;
  if new.empresa_id is null and auth.uid() is null then
    new.empresa_id := (select id from public.empresas where es_predeterminada);
  end if;
  if new.empresa_id is null then
    raise exception 'No se pudo determinar la empresa del registro. Selecciona una empresa.';
  end if;

  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'clientes','equipos','ordenes_servicio','tickets','cotizaciones','facturas','pagos',
    'tecnicos','leads','lead_actividades','marketing_campanas','whatsapp_mensajes',
    'orden_garantias','almacenes','inventario_productos','inventario_existencias',
    'inventario_movimientos'
  ] loop
    -- El prefijo "aa_" hace que corra antes que los demás triggers BEFORE (orden alfabético).
    execute format(
      'create trigger aa_asignar_empresa before insert or update on public.%I
         for each row execute function public.asignar_empresa()', t);
  end loop;
end $$;

-- 6. RLS ---------------------------------------------------------------------------

-- Política restrictiva por tabla: solo la empresa activa. Se suma a las existentes.
do $$
declare t text;
begin
  foreach t in array array[
    'clientes','equipos','ordenes_servicio','tickets','cotizaciones','facturas','pagos',
    'tecnicos','leads','lead_actividades','marketing_campanas','whatsapp_mensajes',
    'orden_garantias','almacenes','inventario_productos','inventario_existencias',
    'inventario_movimientos'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (empresa_id = (select public.empresa_activa()))
         with check (empresa_id = (select public.empresa_activa()))',
      t || '_solo_empresa_activa', t);
  end loop;
end $$;

-- Perfiles: el personal solo ve a los usuarios de su empresa activa y a los
-- clientes del portal de esa empresa (antes veía a todos).
create policy profiles_solo_empresa_activa on public.profiles
  as restrictive for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or id in (select public.usuarios_de_empresa_activa())
    or cliente_id in (select c.id from public.clientes c)
  );

alter table public.empresas enable row level security;
alter table public.usuario_empresas enable row level security;
revoke all on table public.empresas, public.usuario_empresas from anon, authenticated;
grant select, insert, update on table public.empresas to authenticated;
grant select, insert, update, delete on table public.usuario_empresas to authenticated;

create policy empresas_select on public.empresas for select to authenticated
  using (id in (select public.empresas_del_usuario()) or public.is_admin());
create policy empresas_admin_insert on public.empresas for insert to authenticated
  with check (public.is_admin());
create policy empresas_admin_update on public.empresas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy usuario_empresas_select on public.usuario_empresas for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin());
create policy usuario_empresas_admin_insert on public.usuario_empresas for insert to authenticated
  with check (public.is_admin());
create policy usuario_empresas_admin_update on public.usuario_empresas for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy usuario_empresas_admin_delete on public.usuario_empresas for delete to authenticated
  using (public.is_admin());

-- 7. Códigos únicos por empresa (cambio (b)) --------------------------------------

alter table public.almacenes drop constraint almacenes_codigo_key;
create unique index almacenes_empresa_codigo_key on public.almacenes (empresa_id, codigo);
alter table public.inventario_productos drop constraint inventario_productos_codigo_key;
create unique index inventario_productos_empresa_codigo_key on public.inventario_productos (empresa_id, codigo);

-- 8. RPC de asignación: validar empresa (cambio (c)) --------------------------------
-- Es SECURITY DEFINER (no pasa por RLS), así que valida que la orden y el técnico
-- sean de la empresa activa.

create or replace function public.asignar_orden_con_garantia_v2(
  p_orden_id uuid,
  p_tecnico_id uuid,
  p_historial jsonb,
  p_orden_origen_id uuid default null,
  p_tiene_garantia boolean default false,
  p_duracion_valor integer default null,
  p_duracion_unidad text default null,
  p_cobertura text default null,
  p_condiciones text default null,
  p_resultado text default 'Pendiente'
)
returns public.ordenes_servicio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orden public.ordenes_servicio;
  v_empresa uuid := public.empresa_activa();
begin
  if not public.puede_gestionar_operacion() then
    raise exception 'No autorizado para asignar órdenes y configurar garantías'
      using errcode = '42501';
  end if;

  if v_empresa is null or not exists (
    select 1 from public.ordenes_servicio o where o.id = p_orden_id and o.empresa_id = v_empresa
  ) then
    raise exception 'La orden no existe';
  end if;

  if p_tecnico_id is null or not exists (
    select 1 from public.tecnicos t
     where t.id = p_tecnico_id and t.activo and t.empresa_id = v_empresa
  ) then
    raise exception 'El técnico no existe o está inactivo';
  end if;

  if p_tiene_garantia and p_orden_origen_id is null
     and (p_duracion_valor is null or p_duracion_valor <= 0) then
    raise exception 'La duración de la garantía debe ser mayor que cero';
  end if;

  update public.ordenes_servicio
     set tecnico_id = p_tecnico_id,
         estado = 'Asignada',
         historial = coalesce(p_historial, '[]'::jsonb)
   where id = p_orden_id
  returning * into v_orden;

  insert into public.orden_garantias (
    orden_id, orden_origen_id, tiene_garantia, duracion_valor, duracion_unidad,
    cobertura, condiciones, resultado
  ) values (
    p_orden_id, p_orden_origen_id, p_tiene_garantia,
    case when p_tiene_garantia then p_duracion_valor end,
    case when p_tiene_garantia then p_duracion_unidad end,
    case when p_tiene_garantia then p_cobertura end,
    case when p_tiene_garantia then p_condiciones end,
    coalesce(p_resultado, 'Pendiente')
  )
  on conflict (orden_id) do update set
    orden_origen_id = excluded.orden_origen_id,
    tiene_garantia  = excluded.tiene_garantia,
    duracion_valor  = excluded.duracion_valor,
    duracion_unidad = excluded.duracion_unidad,
    cobertura       = excluded.cobertura,
    condiciones     = excluded.condiciones,
    resultado       = excluded.resultado;

  return v_orden;
end;
$$;

-- 9. Folios separados por empresa (cambio (d)) -------------------------------------
-- Un contador por empresa y tipo de documento. Los triggers de folio existentes se
-- reemplazan para usarlo; corren después de aa_asignar_empresa (orden alfabético),
-- así que ya conocen la empresa del registro.

create table public.empresa_folios (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null check (tipo in ('OS', 'TK', 'COT', 'FAC', 'PAG')),
  ultimo bigint not null default 0,
  primary key (empresa_id, tipo)
);
alter table public.empresa_folios enable row level security;
revoke all on table public.empresa_folios from anon, authenticated;

-- ZARAMAN continúa donde va su numeración actual (sin repetir números ya usados).
do $$
declare
  v_zaraman uuid := (select id from public.empresas where clave = 'ZARAMAN');
  v_seq bigint;
begin
  select case when is_called then last_value else last_value - 1 end into v_seq from public.ordenes_folio_seq;
  insert into public.empresa_folios values (v_zaraman, 'OS', greatest(v_seq,
    coalesce((select max(substring(folio from '^OS-([0-9]+)$')::bigint) from public.ordenes_servicio), 0)));
  select case when is_called then last_value else last_value - 1 end into v_seq from public.tickets_folio_seq;
  insert into public.empresa_folios values (v_zaraman, 'TK', greatest(v_seq,
    coalesce((select max(substring(folio from '^TK-([0-9]+)$')::bigint) from public.tickets), 0)));
  select case when is_called then last_value else last_value - 1 end into v_seq from public.cotizaciones_folio_seq;
  insert into public.empresa_folios values (v_zaraman, 'COT', greatest(v_seq,
    coalesce((select max(substring(folio from '^COT-([0-9]+)$')::bigint) from public.cotizaciones), 0)));
  select case when is_called then last_value else last_value - 1 end into v_seq from public.facturas_folio_seq;
  insert into public.empresa_folios values (v_zaraman, 'FAC', greatest(v_seq,
    coalesce((select max(substring(folio from '^FAC-([0-9]+)$')::bigint) from public.facturas), 0)));
  select case when is_called then last_value else last_value - 1 end into v_seq from public.pagos_folio_seq;
  insert into public.empresa_folios values (v_zaraman, 'PAG', greatest(v_seq,
    coalesce((select max(substring(folio from '^PAG-([0-9]+)$')::bigint) from public.pagos), 0)));
end $$;

create or replace function public.siguiente_folio(p_empresa_id uuid, p_tipo text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_n bigint;
  v_prefijo text;
begin
  insert into public.empresa_folios as f (empresa_id, tipo, ultimo)
  values (p_empresa_id, p_tipo, 1)
  on conflict (empresa_id, tipo) do update set ultimo = f.ultimo + 1
  returning ultimo into v_n;

  select prefijo_folio into v_prefijo from public.empresas where id = p_empresa_id;
  return coalesce(v_prefijo || '-', '') || p_tipo || '-' || lpad(v_n::text, 6, '0');
end;
$$;

create or replace function public.set_orden_folio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := public.siguiente_folio(new.empresa_id, 'OS');
  end if;
  return new;
end;
$$;

create or replace function public.set_ticket_folio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := public.siguiente_folio(new.empresa_id, 'TK');
  end if;
  return new;
end;
$$;

create or replace function public.set_cotizacion_folio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := public.siguiente_folio(new.empresa_id, 'COT');
  end if;
  return new;
end;
$$;

create or replace function public.set_factura_folio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := public.siguiente_folio(new.empresa_id, 'FAC');
  end if;
  return new;
end;
$$;

create or replace function public.set_pago_folio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.folio is null or new.folio = '' then
    new.folio := public.siguiente_folio(new.empresa_id, 'PAG');
  end if;
  return new;
end;
$$;

-- 10. Permisos de ejecución --------------------------------------------------------

revoke all on function public.empresas_del_usuario() from public, anon;
revoke all on function public.empresa_activa() from public, anon;
revoke all on function public.seleccionar_empresa(uuid) from public, anon;
revoke all on function public.usuarios_de_empresa_activa() from public, anon;
revoke all on function public.empresa_de(text, uuid) from public, anon, authenticated;
revoke all on function public.asignar_empresa() from public, anon, authenticated;
revoke all on function public.siguiente_folio(uuid, text) from public, anon, authenticated;
revoke all on function public.set_orden_folio() from public, anon, authenticated;
revoke all on function public.set_ticket_folio() from public, anon, authenticated;
revoke all on function public.set_cotizacion_folio() from public, anon, authenticated;
revoke all on function public.set_factura_folio() from public, anon, authenticated;
revoke all on function public.set_pago_folio() from public, anon, authenticated;
grant execute on function public.empresas_del_usuario() to authenticated;
grant execute on function public.empresa_activa() to authenticated;
grant execute on function public.seleccionar_empresa(uuid) to authenticated;
grant execute on function public.usuarios_de_empresa_activa() to authenticated;

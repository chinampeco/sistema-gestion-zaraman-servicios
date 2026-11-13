-- Fase 2b: garantías (fianzas) de contratos y orden de servicio por equipo.
--
-- * contrato_garantias: cada garantía que pide el contrato (cumplimiento,
--   calidad, anticipo...) con su seguimiento: requerida o exceptuada, monto,
--   afianzadora, póliza, folio, línea de validación, fechas y estado. Se liga
--   al formato que da la dependencia y a la póliza que entrega la afianzadora
--   (ambos en el expediente).
-- * contrato_partidas: número de ficha técnica, nombre del proyecto y la lista
--   de actividades de la ficha (para llenar la orden tipo "visita de campo").
-- * equipos: número de inventario (p. ej. S.I.L. de SEDENA).
-- * ordenes_servicio: referencia de la dependencia (p. ej. SAE-PTAR-ISSFAM-12)
--   y actividades con su columna "operativo" (lo que se hizo / observación).
--
-- * orden_equipos: varios equipos en una orden (formato por partida/ficha),
--   cada uno con "realizado" y observaciones.
-- * empresas: representante legal y giro para los formatos impresos.
--
-- Solo cambios aditivos: tablas y columnas nuevas, sin DROP. Único cambio de
-- datos: llenar el representante legal de TOLTECATL y BOCAM (estaba vacío).

-- 1. Garantías ------------------------------------------------------------------

create table public.contrato_garantias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  tipo text not null default 'Cumplimiento'
    check (tipo in ('Cumplimiento', 'Calidad / vicios ocultos', 'Anticipo',
                    'Responsabilidad civil', 'Otra')),
  forma text not null default 'Póliza de fianza'
    check (forma in ('Póliza de fianza', 'Carta de crédito (Stand By)', 'Cheque certificado',
                     'Escrito libre', 'Otra')),
  requerida boolean not null default true,
  -- Exceptuada: p. ej. entrega en menos de 10 días naturales (art. 69 LAASSP).
  motivo_excepcion text not null default '',
  porcentaje numeric(5,2) check (porcentaje between 0 and 100),
  monto numeric(14,2) check (monto >= 0),
  moneda text not null default 'MXN',
  divisible boolean not null default true,
  beneficiaria text not null default 'Tesorería de la Federación',
  beneficiaria_domicilio text not null default '',
  afianzadora text not null default '',
  numero_poliza text not null default '',
  folio text not null default '',
  linea_validacion text not null default '',
  fecha_expedicion date,
  fecha_limite_entrega date,
  fecha_entrega date,
  vigencia_hasta date,
  estado text not null default 'Por tramitar'
    check (estado in ('Por tramitar', 'Solicitada', 'Emitida', 'Entregada',
                      'Liberada', 'Cancelada', 'Exceptuada')),
  documento_formato_id uuid references public.contrato_documentos(id) on delete set null,
  documento_poliza_id uuid references public.contrato_documentos(id) on delete set null,
  notas text not null default '',
  creado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contrato_garantias_exceptuada_sin_requerir
    check (estado <> 'Exceptuada' or not requerida)
);

create index contrato_garantias_contrato_idx on public.contrato_garantias (contrato_id);
create index contrato_garantias_pendientes_idx on public.contrato_garantias (empresa_id, estado, fecha_limite_entrega);

create trigger trg_touch_contrato_garantias before update on public.contrato_garantias
  for each row execute function public.touch_updated_at();

-- Los documentos ligados deben ser del mismo contrato.
create or replace function public.validar_documentos_garantia()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.documento_formato_id is not null and not exists (
       select 1 from public.contrato_documentos d
       where d.id = new.documento_formato_id and d.contrato_id = new.contrato_id) then
    raise exception 'El formato de la garantía debe estar en el expediente del mismo contrato';
  end if;
  if new.documento_poliza_id is not null and not exists (
       select 1 from public.contrato_documentos d
       where d.id = new.documento_poliza_id and d.contrato_id = new.contrato_id) then
    raise exception 'La póliza debe estar en el expediente del mismo contrato';
  end if;
  if tg_op = 'UPDATE' and new.contrato_id is distinct from old.contrato_id then
    raise exception 'La garantía no se puede mover a otro contrato';
  end if;
  return new;
end;
$$;

create trigger trg_validar_documentos_garantia
  before insert or update on public.contrato_garantias
  for each row execute function public.validar_documentos_garantia();

-- asignar_empresa(): la garantía toma la empresa de su contrato. Se agrega el
-- caso sin tocar los demás (misma función que la migración anterior + 1 línea).
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
    when 'contratos'              then public.empresa_de('clientes', (r->>'cliente_id')::uuid)
    when 'contrato_partidas'      then public.empresa_de('contratos', (r->>'contrato_id')::uuid)
    when 'contrato_documentos'    then public.empresa_de('contratos', (r->>'contrato_id')::uuid)
    when 'contrato_garantias'     then public.empresa_de('contratos', (r->>'contrato_id')::uuid)
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

create trigger aa_asignar_empresa before insert or update on public.contrato_garantias
  for each row execute function public.asignar_empresa();

revoke all on function public.asignar_empresa() from public, anon, authenticated;
revoke all on function public.validar_documentos_garantia() from public, anon, authenticated;

alter table public.contrato_garantias enable row level security;

create policy contrato_garantias_select on public.contrato_garantias for select to authenticated
  using (public.is_staff() and not public.is_tecnico());
create policy contrato_garantias_insert on public.contrato_garantias for insert to authenticated
  with check (public.puede_gestionar_operacion());
create policy contrato_garantias_update on public.contrato_garantias for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());
create policy contrato_garantias_delete on public.contrato_garantias for delete to authenticated
  using (public.is_admin());
create policy contrato_garantias_solo_empresa_activa on public.contrato_garantias
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

-- 2. Ficha técnica en la partida --------------------------------------------------
-- actividades: [{ "numero": 1, "titulo": "Equipo electromecánico",
--                 "detalle": ["Verificación y/o rebobinado", "Cambio de rodamientos"] }]

alter table public.contrato_partidas
  add column ficha_tecnica text not null default '',
  add column nombre_proyecto text not null default '',
  add column actividades jsonb not null default '[]'::jsonb
    check (jsonb_typeof(actividades) = 'array');

-- 3. Número de inventario del equipo ----------------------------------------------

alter table public.equipos
  add column numero_inventario text not null default '';

create index equipos_numero_inventario_idx on public.equipos (empresa_id, numero_inventario)
  where numero_inventario <> '';

-- 4. Orden: referencia de la dependencia y actividades con "operativo" -------------
-- actividades: [{ "numero": 1, "titulo": "...", "detalle": ["..."],
--                 "operativo": "Se cambiaron rodamientos", "realizada": true }]

alter table public.ordenes_servicio
  add column referencia text not null default '',
  add column actividades jsonb not null default '[]'::jsonb
    check (jsonb_typeof(actividades) = 'array');

-- Una orden de contrato sin actividades propias toma las de su partida (ficha).
create or replace function public.actividades_orden_por_defecto()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.contrato_partida_id is not null
     and coalesce(jsonb_array_length(new.actividades), 0) = 0 then
    select p.actividades into new.actividades
      from public.contrato_partidas p where p.id = new.contrato_partida_id;
    new.actividades := coalesce(new.actividades, '[]'::jsonb);
  end if;
  return new;
end;
$$;

revoke all on function public.actividades_orden_por_defecto() from public, anon, authenticated;

-- "ad_": después de ab_validar_contrato_orden y ac_ubicacion_orden.
create trigger ad_actividades_orden
  before insert on public.ordenes_servicio
  for each row execute function public.actividades_orden_por_defecto();

-- 5. Varios equipos por orden --------------------------------------------------
-- Las órdenes de TOLTECATL (por partida) y BOCAM (por ficha) listan varios
-- equipos; cada equipo conserva su historial. Sirve igual si la orden es de un
-- solo equipo (ordenes_servicio.equipo_id sigue siendo el equipo principal).

create table public.orden_equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  orden_id uuid not null references public.ordenes_servicio(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete restrict,
  realizado boolean not null default false,
  observaciones text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orden_equipos_unico unique (orden_id, equipo_id)
);

create index orden_equipos_equipo_idx on public.orden_equipos (equipo_id);

create trigger trg_touch_orden_equipos before update on public.orden_equipos
  for each row execute function public.touch_updated_at();

-- El equipo debe ser del mismo cliente que la orden; orden y equipo no cambian.
create or replace function public.validar_orden_equipo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.orden_id is distinct from old.orden_id
                           or new.equipo_id is distinct from old.equipo_id) then
    raise exception 'No se puede cambiar la orden ni el equipo; quita el renglón y agrégalo de nuevo';
  end if;
  if (select cliente_id from public.equipos where id = new.equipo_id)
     is distinct from (select cliente_id from public.ordenes_servicio where id = new.orden_id) then
    raise exception 'El equipo debe ser del mismo cliente que la orden';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_orden_equipo() from public, anon, authenticated;

create trigger trg_validar_orden_equipo before insert or update on public.orden_equipos
  for each row execute function public.validar_orden_equipo();

-- Misma regla de empresa que el resto: la toma de su orden.
create or replace function public.asignar_empresa_orden_equipo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v uuid;
begin
  v := public.empresa_de('ordenes_servicio', new.orden_id);
  if tg_op = 'UPDATE' and new.empresa_id is distinct from old.empresa_id then
    raise exception 'No se puede cambiar la empresa de un registro existente';
  end if;
  if new.empresa_id is null then
    new.empresa_id := v;
  elsif new.empresa_id <> v then
    raise exception 'El registro y su registro relacionado pertenecen a empresas distintas';
  end if;
  return new;
end;
$$;

revoke all on function public.asignar_empresa_orden_equipo() from public, anon, authenticated;

create trigger aa_asignar_empresa before insert or update on public.orden_equipos
  for each row execute function public.asignar_empresa_orden_equipo();

alter table public.orden_equipos enable row level security;

-- Quien ve la orden (según las reglas actuales de órdenes, incluida la del
-- técnico asignado) ve sus equipos. Captura: gestión. El técnico puede marcar
-- "realizado" en los equipos de sus órdenes.
create policy orden_equipos_select on public.orden_equipos for select to authenticated
  using (exists (select 1 from public.ordenes_servicio o where o.id = orden_id));
create policy orden_equipos_insert on public.orden_equipos for insert to authenticated
  with check (public.puede_gestionar_operacion()
              and exists (select 1 from public.ordenes_servicio o where o.id = orden_id));
create policy orden_equipos_update on public.orden_equipos for update to authenticated
  using ((public.puede_gestionar_operacion() or public.is_tecnico())
         and exists (select 1 from public.ordenes_servicio o where o.id = orden_id))
  with check ((public.puede_gestionar_operacion() or public.is_tecnico())
              and exists (select 1 from public.ordenes_servicio o where o.id = orden_id));
create policy orden_equipos_delete on public.orden_equipos for delete to authenticated
  using (public.puede_gestionar_operacion());
create policy orden_equipos_solo_empresa_activa on public.orden_equipos
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

-- 6. Representante legal (firma "Verificó / Visto bueno" de los formatos) --------

alter table public.empresas
  add column representante_legal text not null default '',
  add column representante_cargo text not null default 'Representante Legal',
  add column giro text not null default '';

update public.empresas set
  representante_legal = 'Leonardo Palacios Santiago',
  giro = 'Suministro, diseño, instalación y mantenimiento de redes eléctricas en baja y media tensión, sistemas de aire acondicionado y refrigeración, sistemas de respaldo eléctrico, sistemas de protección contra descargas atmosféricas y tierras físicas, sistemas contraincendios, así como suministro y reparación de equipos médicos.'
where clave = 'TOLTECATL' and representante_legal = '';

update public.empresas set
  representante_legal = 'L.A.E. Ivonne Obregón Gutiérrez'
where clave = 'BOCAM' and representante_legal = '';

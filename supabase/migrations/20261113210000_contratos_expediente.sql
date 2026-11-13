-- Fase 2: contratos, partidas y expediente digital por empresa.
--
-- * contratos: datos del instrumento (dependencia, número, procedimiento,
--   vigencia, montos, garantías, penas, administrador del contrato).
-- * contrato_partidas: lo que se contrató (partida, cantidad, precio) y su
--   alcance técnico; `equipos` guarda la relación de equipos del anexo técnico
--   para generar órdenes después (fase 4).
-- * contrato_documentos + bucket privado "expedientes": el expediente digital
--   (contrato, anexos, fianza, actas, CFDI, opiniones de cumplimiento...).
-- * ordenes_servicio.contrato_id / contrato_partida_id: enlace de la orden con
--   su contrato; una orden con contrato nace con procedencia 'Contrato'.
--
-- Cambios aditivos: tablas y columnas nuevas, sin DROP ni cambios a datos
-- existentes (salvo completar los datos de contacto de ZARAMAN).
-- El personal operativo lee; Administrador/Coordinador/Supervisor capturan;
-- solo el Administrador borra. Los técnicos no ven contratos ni montos.

-- 0. Datos de contacto de ZARAMAN ------------------------------------------------

update public.empresas set
  domicilio = 'Aguiluchos 370, Fracc. Las Águilas, Tuxtla Gutiérrez, Chiapas, C.P. 29049',
  telefono  = '+52 81 4891 0031',
  email     = 'fernando@zaraman.com.mx'
where clave = 'ZARAMAN';

-- 1. Contratos --------------------------------------------------------------------

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  numero_contrato text not null check (btrim(numero_contrato) <> ''),
  objeto text not null default '',
  area_requirente text not null default '',
  procedimiento text not null default 'Adjudicación directa'
    check (procedimiento in ('Licitación pública', 'Invitación a cuando menos tres personas',
                             'Adjudicación directa', 'Otro')),
  caracter text not null default 'Nacional'
    check (caracter in ('Nacional', 'Internacional', 'Internacional bajo tratados')),
  electronico boolean not null default true,
  fecha_firma date,
  vigencia_inicio date,
  vigencia_fin date,
  fecha_limite_entrega date,
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  iva numeric(14,2) not null default 0 check (iva >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  moneda text not null default 'MXN',
  anticipo_pct numeric(5,2) not null default 0 check (anticipo_pct between 0 and 100),
  garantia_cumplimiento_pct numeric(5,2) check (garantia_cumplimiento_pct between 0 and 100),
  garantia_calidad_meses integer check (garantia_calidad_meses >= 0),
  pena_diaria_pct numeric(5,2) check (pena_diaria_pct between 0 and 100),
  pena_maxima_pct numeric(5,2) check (pena_maxima_pct between 0 and 100),
  plazo_pago_dias_habiles integer check (plazo_pago_dias_habiles >= 0),
  administrador_nombre text not null default '',
  administrador_cargo text not null default '',
  lugar_ejecucion text not null default '',
  contacto_telefono text not null default '',
  contacto_email text not null default '',
  suficiencia_presupuestal text not null default '',
  estado text not null default 'Por iniciar'
    check (estado in ('Por iniciar', 'En ejecución', 'Entregado', 'Finiquitado',
                      'Rescindido', 'Cancelado')),
  notas text not null default '',
  creado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contratos_vigencia_valida
    check (vigencia_inicio is null or vigencia_fin is null or vigencia_fin >= vigencia_inicio),
  constraint contratos_numero_unico unique (empresa_id, numero_contrato)
);

create index contratos_empresa_estado_idx on public.contratos (empresa_id, estado);
create index contratos_cliente_idx on public.contratos (cliente_id);

-- 2. Partidas ------------------------------------------------------------------

create table public.contrato_partidas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  numero integer not null check (numero > 0),
  descripcion text not null check (btrim(descripcion) <> ''),
  unidad text not null default 'Servicio',
  cantidad numeric(12,2) not null default 1 check (cantidad > 0),
  precio_unitario numeric(14,2) not null default 0 check (precio_unitario >= 0),
  importe numeric(14,2) generated always as (round(cantidad * precio_unitario, 2)) stored,
  cucop text not null default '',
  alcance text not null default '',
  lugar_ejecucion text not null default '',
  -- [{ "descripcion", "cantidad", "marca", "modelo", "serie", "inventario" }]
  equipos jsonb not null default '[]'::jsonb check (jsonb_typeof(equipos) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contrato_partidas_numero_unico unique (contrato_id, numero)
);

create index contrato_partidas_empresa_idx on public.contrato_partidas (empresa_id);

-- 3. Expediente (metadatos; el archivo vive en el bucket "expedientes") ----------

create table public.contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  -- restrict: para borrar un contrato primero se depura su expediente.
  contrato_id uuid not null references public.contratos(id) on delete restrict,
  tipo text not null default 'Otro'
    check (tipo in ('Contrato', 'Anexo técnico', 'Propuesta técnica', 'Propuesta económica',
                    'Anexo administrativo', 'Convocatoria', 'Fallo',
                    'Garantía de cumplimiento', 'Garantía de calidad', 'Convenio modificatorio',
                    'Acta de entrega-recepción', 'Constancia de recepción', 'Informe de servicio',
                    'CFDI', 'Opinión de cumplimiento', 'Otro')),
  nombre_archivo text not null,
  storage_path text not null unique,
  mime_type text not null default '',
  tamano_bytes bigint not null default 0 check (tamano_bytes >= 0),
  fecha_documento date,
  vigente_hasta date,
  notas text not null default '',
  subido_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- El archivo debe estar en la carpeta de su empresa y contrato.
  constraint contrato_documentos_ruta_valida
    check (storage_path like empresa_id::text || '/' || contrato_id::text || '/%')
);

create index contrato_documentos_contrato_idx on public.contrato_documentos (contrato_id, tipo);
create index contrato_documentos_empresa_idx on public.contrato_documentos (empresa_id);

-- 4. Enlace orden ↔ contrato -----------------------------------------------------

alter table public.ordenes_servicio
  add column contrato_id uuid references public.contratos(id) on delete restrict,
  add column contrato_partida_id uuid references public.contrato_partidas(id) on delete restrict;

create index ordenes_servicio_contrato_idx on public.ordenes_servicio (contrato_id)
  where contrato_id is not null;

-- 5. Triggers ---------------------------------------------------------------------

create trigger trg_touch_contratos before update on public.contratos
  for each row execute function public.touch_updated_at();
create trigger trg_touch_contrato_partidas before update on public.contrato_partidas
  for each row execute function public.touch_updated_at();
create trigger trg_touch_contrato_documentos before update on public.contrato_documentos
  for each row execute function public.touch_updated_at();

-- asignar_empresa(): misma función de la fase 1 + contratos y sus hijos.
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

create trigger aa_asignar_empresa before insert or update on public.contratos
  for each row execute function public.asignar_empresa();
create trigger aa_asignar_empresa before insert or update on public.contrato_partidas
  for each row execute function public.asignar_empresa();
create trigger aa_asignar_empresa before insert or update on public.contrato_documentos
  for each row execute function public.asignar_empresa();

-- El cliente de un contrato no cambia (sus partidas, órdenes y expediente cuelgan de él).
create or replace function public.contrato_cliente_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cliente_id is distinct from old.cliente_id then
    raise exception 'No se puede cambiar el cliente de un contrato existente';
  end if;
  return new;
end;
$$;

create trigger trg_contrato_cliente_inmutable before update on public.contratos
  for each row execute function public.contrato_cliente_inmutable();

-- El documento no se mueve de contrato ni de archivo.
create or replace function public.contrato_documento_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contrato_id is distinct from old.contrato_id
     or new.storage_path is distinct from old.storage_path then
    raise exception 'El documento no se puede mover a otro contrato ni cambiar de archivo';
  end if;
  return new;
end;
$$;

create trigger trg_contrato_documento_inmutable before update on public.contrato_documentos
  for each row execute function public.contrato_documento_inmutable();

-- Orden con contrato: la partida debe ser del contrato y el contrato del mismo
-- cliente y empresa que la orden. Si solo llega la partida, se toma su contrato.
create or replace function public.validar_contrato_orden()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_contrato_de_partida uuid;
  v_empresa uuid;
  v_cliente uuid;
begin
  if new.contrato_partida_id is not null then
    select contrato_id into v_contrato_de_partida
      from public.contrato_partidas where id = new.contrato_partida_id;
    if new.contrato_id is null then
      new.contrato_id := v_contrato_de_partida;
    elsif new.contrato_id <> v_contrato_de_partida then
      raise exception 'La partida no pertenece al contrato indicado';
    end if;
  end if;

  if new.contrato_id is not null then
    select empresa_id, cliente_id into v_empresa, v_cliente
      from public.contratos where id = new.contrato_id;
    if v_empresa <> new.empresa_id then
      raise exception 'El contrato pertenece a otra empresa';
    end if;
    if v_cliente <> new.cliente_id then
      raise exception 'La orden debe ser del mismo cliente que el contrato';
    end if;
  end if;

  return new;
end;
$$;

-- "ab_": corre después de aa_asignar_empresa (ya con empresa_id) y antes de la procedencia.
create trigger ab_validar_contrato_orden
  before insert or update of contrato_id, contrato_partida_id, cliente_id on public.ordenes_servicio
  for each row execute function public.validar_contrato_orden();

-- Procedencia: misma función de la fase 1 + 'Contrato' cuando la orden trae contrato.
create or replace function public.asignar_procedencia_orden()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.procedencia := old.procedencia;
    return new;
  end if;

  if new.procedencia is null or new.procedencia = 'Manual' then
    new.procedencia := case
      when new.contrato_id is not null then 'Contrato'
      when new.ticket_id is not null then 'Ticket'
      when new.es_garantia or new.orden_origen_id is not null then 'Garantía'
      else 'Manual'
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.asignar_empresa() from public, anon, authenticated;
revoke all on function public.asignar_procedencia_orden() from public, anon, authenticated;
revoke all on function public.contrato_cliente_inmutable() from public, anon, authenticated;
revoke all on function public.contrato_documento_inmutable() from public, anon, authenticated;
revoke all on function public.validar_contrato_orden() from public, anon, authenticated;

-- 6. RLS --------------------------------------------------------------------------

alter table public.contratos enable row level security;
alter table public.contrato_partidas enable row level security;
alter table public.contrato_documentos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['contratos', 'contrato_partidas', 'contrato_documentos'] loop
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_staff() and not public.is_tecnico())', t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.puede_gestionar_operacion())', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.puede_gestionar_operacion())
         with check (public.puede_gestionar_operacion())', t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_admin())', t || '_delete', t);
    -- Igual que en la fase 1: además, solo la empresa activa.
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (empresa_id = (select public.empresa_activa()))
         with check (empresa_id = (select public.empresa_activa()))',
      t || '_solo_empresa_activa', t);
  end loop;
end $$;

-- 7. Bucket privado del expediente ---------------------------------------------
-- Ruta: {empresa_id}/{contrato_id}/{archivo}. Solo se lee con URL firmada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expedientes', 'expedientes', false, 26214400,  -- 25 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/xml', 'text/xml',
    'image/jpeg', 'image/png'
  ]
);

create policy expedientes_select on storage.objects for select to authenticated
  using (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.empresa_activa())::text
    and public.is_staff() and not public.is_tecnico()
  );

create policy expedientes_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.empresa_activa())::text
    and exists (
      select 1 from public.contratos c
      where c.id::text = (storage.foldername(name))[2]
        and c.empresa_id = (select public.empresa_activa())
    )
    and public.puede_gestionar_operacion()
  );

create policy expedientes_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.empresa_activa())::text
    and public.is_admin()
  );
-- Sin política de UPDATE: un archivo del expediente no se sobrescribe.

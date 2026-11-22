-- Módulo de Licitaciones por empresa.
--
--   licitaciones            Una por procedimiento (licitación pública, invitación o
--                           adjudicación). Guarda lo que la IA leyó de la convocatoria
--                           (partidas, tabla de puntos, recomendaciones) y del fallo.
--   licitacion_documentos   Convocatoria, anexos, actas, propuestas, acuse ComprasMX…
--                           Archivos en el bucket privado "expedientes":
--                           {empresa_id}/licitaciones/{licitacion_id}/...
--   licitacion_requisitos   Lista de cumplimiento: cada formato, documento o requisito
--                           de puntos, con su estado y el archivo que lo cubre.
--   licitacion_eventos      Fechas (junta, visitas, apertura, fallo, firma, fianza…)
--                           para los recordatorios.
--
-- Cambios aditivos: tablas, funciones y triggers nuevos. Sin DROP ni cambios a
-- tablas existentes. Los archivos se suben con URL firmada desde el servidor y se
-- leen/borran con las políticas existentes del bucket (carpeta de la empresa activa).

-- 1. Tablas --------------------------------------------------------------------------

create table public.licitaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  numero text not null default '',
  expediente text not null default '',
  dependencia text not null default '',
  unidad_compradora text not null default '',
  objeto text not null default '',
  tipo_procedimiento text not null default 'Licitación pública'
    check (tipo_procedimiento in (
      'Licitación pública', 'Invitación a cuando menos tres personas', 'Adjudicación directa', 'Otro'
    )),
  caracter text not null default '',
  criterio_evaluacion text not null default '',
  estado text not null default 'En preparación'
    check (estado in (
      'En preparación', 'Propuesta enviada', 'En evaluación', 'Ganada', 'Ganada parcial',
      'Perdida', 'Desechada', 'Desierta', 'Cancelada', 'No participó'
    )),
  puntos_tecnicos_max numeric(6,2),
  puntos_economicos_max numeric(6,2),
  -- [{numero, descripcion, ubicacion, ofertar, precio_ofertado}]
  partidas jsonb not null default '[]'::jsonb check (jsonb_typeof(partidas) = 'array'),
  -- [{rubro, subrubro, clave, descripcion, maximo, como_acreditar, niveles:[{condicion, puntos}]}]
  tabla_puntos jsonb not null default '[]'::jsonb check (jsonb_typeof(tabla_puntos) = 'array'),
  -- {resumen, recomendaciones[], riesgos[], causales_desechamiento[]}
  analisis jsonb not null default '{}'::jsonb check (jsonb_typeof(analisis) = 'object'),
  -- Lectura del acta de fallo: {resumen, nuestras[], ganadores[], puntos_perdidos[], lecciones[]}
  resultado jsonb not null default '{}'::jsonb check (jsonb_typeof(resultado) = 'object'),
  monto_adjudicado numeric(14,2),
  contrato_id uuid references public.contratos(id) on delete set null,
  notas text not null default '',
  creado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licitaciones_empresa_estado_idx on public.licitaciones (empresa_id, estado);
create unique index licitaciones_numero_unico on public.licitaciones (empresa_id, numero) where numero <> '';

create table public.licitacion_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  tipo text not null default 'Otro'
    check (tipo in (
      'Convocatoria', 'Anexo técnico', 'Anexo administrativo', 'Anexo de evaluación (puntos)',
      'Junta de aclaraciones', 'Acta de apertura', 'Acta de fallo',
      'Propuesta técnica', 'Propuesta económica', 'Documentación legal',
      'Acuse ComprasMX', 'Evidencia de visita', 'Contrato', 'Otro'
    )),
  descripcion text not null default '',
  nombre_archivo text not null,
  storage_path text not null unique,
  mime_type text not null default '',
  tamano_bytes bigint not null default 0 check (tamano_bytes >= 0),
  analizado_at timestamptz,
  subido_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint licitacion_documentos_ruta_valida
    check (storage_path like empresa_id::text || '/licitaciones/' || licitacion_id::text || '/%')
);

create index licitacion_documentos_licitacion_idx on public.licitacion_documentos (licitacion_id);

create table public.licitacion_requisitos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  categoria text not null default 'Otro'
    check (categoria in ('Legal y administrativo', 'Técnico', 'Económico', 'Puntos', 'Formalización', 'Otro')),
  numeral text not null default '',
  descripcion text not null,
  formato text not null default '',
  obligatorio boolean not null default true,
  -- true: si falta o está mal, desechan la propuesta.
  desecha boolean not null default false,
  puntos_max numeric(6,2),
  puntos_esperados numeric(6,2),
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente', 'En proceso', 'Listo', 'No aplica')),
  documento_id uuid references public.licitacion_documentos(id) on delete set null,
  empresa_documento_id uuid references public.empresa_documentos(id) on delete set null,
  responsable text not null default '',
  notas text not null default '',
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licitacion_requisitos_licitacion_idx on public.licitacion_requisitos (licitacion_id, orden);

create table public.licitacion_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  licitacion_id uuid not null references public.licitaciones(id) on delete cascade,
  tipo text not null default 'Otro'
    check (tipo in (
      'Publicación', 'Límite de preguntas', 'Junta de aclaraciones', 'Visita de campo',
      'Presentación y apertura', 'Fallo', 'Entrega de documentos', 'Firma de contrato',
      'Garantía de cumplimiento', 'Entrega del servicio', 'Otro'
    )),
  titulo text not null default '',
  fecha timestamptz not null,
  recordar_dias integer not null default 2 check (recordar_dias between 0 and 60),
  completado boolean not null default false,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licitacion_eventos_empresa_fecha_idx on public.licitacion_eventos (empresa_id, fecha) where not completado;
create index licitacion_eventos_licitacion_idx on public.licitacion_eventos (licitacion_id, fecha);

-- 2. Triggers ------------------------------------------------------------------------

create trigger trg_touch_licitaciones before update on public.licitaciones
  for each row execute function public.touch_updated_at();
create trigger trg_touch_licitacion_documentos before update on public.licitacion_documentos
  for each row execute function public.touch_updated_at();
create trigger trg_touch_licitacion_requisitos before update on public.licitacion_requisitos
  for each row execute function public.touch_updated_at();
create trigger trg_touch_licitacion_eventos before update on public.licitacion_eventos
  for each row execute function public.touch_updated_at();

-- La licitación toma la empresa activa (misma función que el resto de las tablas).
create trigger aa_asignar_empresa before insert or update on public.licitaciones
  for each row execute function public.asignar_empresa();

-- Documentos, requisitos y fechas toman la empresa de su licitación.
create or replace function public.licitacion_hijo_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if tg_op = 'UPDATE' and (new.empresa_id is distinct from old.empresa_id
                           or new.licitacion_id is distinct from old.licitacion_id) then
    raise exception 'No se puede mover el registro a otra empresa o licitación';
  end if;
  select empresa_id into v_empresa from public.licitaciones where id = new.licitacion_id;
  if v_empresa is null then
    raise exception 'La licitación no existe';
  end if;
  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id <> v_empresa then
    raise exception 'El registro y su licitación pertenecen a empresas distintas';
  end if;
  return new;
end;
$$;

create trigger aa_licitacion_empresa before insert or update on public.licitacion_documentos
  for each row execute function public.licitacion_hijo_empresa();
create trigger aa_licitacion_empresa before insert or update on public.licitacion_requisitos
  for each row execute function public.licitacion_hijo_empresa();
create trigger aa_licitacion_empresa before insert or update on public.licitacion_eventos
  for each row execute function public.licitacion_hijo_empresa();

-- El documento no cambia de archivo.
create or replace function public.licitacion_documento_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.storage_path is distinct from old.storage_path then
    raise exception 'El documento no puede cambiar de archivo; sube uno nuevo';
  end if;
  return new;
end;
$$;

create trigger trg_licitacion_documento_inmutable before update on public.licitacion_documentos
  for each row execute function public.licitacion_documento_inmutable();

revoke all on function public.licitacion_hijo_empresa() from public, anon, authenticated;
revoke all on function public.licitacion_documento_inmutable() from public, anon, authenticated;

-- 3. RLS (igual que contratos) ----------------------------------------------------------
-- Personal (no técnicos ni clientes) consulta; gestión crea y edita; solo Administrador
-- borra; y siempre solo la empresa activa.

alter table public.licitaciones enable row level security;
alter table public.licitacion_documentos enable row level security;
alter table public.licitacion_requisitos enable row level security;
alter table public.licitacion_eventos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['licitaciones', 'licitacion_documentos', 'licitacion_requisitos', 'licitacion_eventos'] loop
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
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (empresa_id = (select public.empresa_activa()))
         with check (empresa_id = (select public.empresa_activa()))',
      t || '_solo_empresa_activa', t);
  end loop;
end $$;

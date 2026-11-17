-- Expediente corporativo de cada empresa (documentos para ComprasMX y licitaciones):
-- opiniones de cumplimiento SAT / IMSS / INFONAVIT, constancia de situación
-- fiscal, acta constitutiva, poderes, identificación del representante,
-- vigencia de la e.firma (captura o PDF del certificado; NUNCA la llave privada),
-- REPSE, MIPYME, etc.
--
-- Cada documento guarda fecha de emisión y "vigente hasta" para avisar
-- vencimientos y validar si estará vigente en la fecha de una licitación.
-- Los archivos van al bucket privado "expedientes" en {empresa_id}/empresa/...
--
-- Cambios aditivos: tabla nueva y una política de storage nueva. Sin DROP.

create table public.empresa_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  tipo text not null
    check (tipo in (
      'Opinión de cumplimiento SAT (32-D)',
      'Opinión de cumplimiento IMSS',
      'Constancia de situación INFONAVIT',
      'Constancia de situación fiscal',
      'Acta constitutiva',
      'Acta de asamblea / modificaciones',
      'Poder notarial del representante legal',
      'Identificación oficial del representante legal',
      'Comprobante de domicilio fiscal',
      'Vigencia de la e.firma',
      'Registro REPSE',
      'Estratificación MIPYME',
      'Carátula de estado de cuenta (CLABE)',
      'Declaración anual / estados financieros',
      'Registro patronal IMSS',
      'Registro ComprasMX / Registro Único de Participantes',
      'Currículum de la empresa',
      'Otro'
    )),
  descripcion text not null default '',
  nombre_archivo text not null,
  storage_path text not null unique,
  mime_type text not null default '',
  tamano_bytes bigint not null default 0 check (tamano_bytes >= 0),
  fecha_emision date,
  vigente_hasta date,
  notas text not null default '',
  subido_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_documentos_vigencia_valida
    check (fecha_emision is null or vigente_hasta is null or vigente_hasta >= fecha_emision),
  constraint empresa_documentos_ruta_valida
    check (storage_path like empresa_id::text || '/empresa/%')
);

create index empresa_documentos_empresa_tipo_idx on public.empresa_documentos (empresa_id, tipo, vigente_hasta);

create trigger trg_touch_empresa_documentos before update on public.empresa_documentos
  for each row execute function public.touch_updated_at();

-- Misma regla de empresa que el resto de las tablas (toma la empresa activa).
create trigger aa_asignar_empresa before insert or update on public.empresa_documentos
  for each row execute function public.asignar_empresa();

-- El documento no se mueve de empresa ni de archivo.
create or replace function public.empresa_documento_inmutable()
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

revoke all on function public.empresa_documento_inmutable() from public, anon, authenticated;

create trigger trg_empresa_documento_inmutable before update on public.empresa_documentos
  for each row execute function public.empresa_documento_inmutable();

alter table public.empresa_documentos enable row level security;

-- Personal (no técnicos ni clientes) consulta; gestión sube y edita; solo Administrador borra.
create policy empresa_documentos_select on public.empresa_documentos for select to authenticated
  using (public.is_staff() and not public.is_tecnico());
create policy empresa_documentos_insert on public.empresa_documentos for insert to authenticated
  with check (public.puede_gestionar_operacion());
create policy empresa_documentos_update on public.empresa_documentos for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());
create policy empresa_documentos_delete on public.empresa_documentos for delete to authenticated
  using (public.is_admin());
create policy empresa_documentos_solo_empresa_activa on public.empresa_documentos
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

-- Storage: subir a {empresa_activa}/empresa/... en el bucket privado "expedientes".
-- (Leer y borrar ya lo cubren expedientes_select / expedientes_delete, que
--  exigen la carpeta de la empresa activa.)
create policy expedientes_empresa_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.empresa_activa())::text
    and (storage.foldername(name))[2] = 'empresa'
    and public.puede_gestionar_operacion()
  );

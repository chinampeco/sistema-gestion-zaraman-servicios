-- Expediente y perfil de cada técnico: documentos (CV, cédula, DC-3, INE,
-- alta IMSS, examen médico…) con vigencia, y un perfil (especialidades, marcas,
-- certificaciones, experiencia) que arma la IA a partir de ellos y el usuario
-- corrige. Con eso y su historial de órdenes se sugiere el técnico más apto al
-- asignar. Cambios aditivos: columnas, tabla y una política de storage.

alter table public.tecnicos
  add column lugar_origen text not null default '',
  add column regiones_trabajo text[] not null default '{}',
  add column perfil jsonb not null default '{}'::jsonb,
  add column perfil_actualizado_at timestamptz;

create table public.tecnico_documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  tecnico_id uuid not null references public.tecnicos(id) on delete cascade,
  tipo text not null
    check (tipo in (
      'Currículum', 'Cédula profesional', 'Título / certificado de estudios',
      'Constancia DC-3', 'Certificación / curso', 'Identificación oficial (INE)',
      'CURP', 'Alta IMSS / NSS', 'Licencia de manejo', 'Examen médico',
      'Constancia de antecedentes', 'Otro'
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
  constraint tecnico_documentos_vigencia_valida
    check (fecha_emision is null or vigente_hasta is null or vigente_hasta >= fecha_emision),
  constraint tecnico_documentos_ruta_valida
    check (storage_path like empresa_id::text || '/tecnicos/' || tecnico_id::text || '/%')
);

create index tecnico_documentos_tecnico_idx on public.tecnico_documentos (tecnico_id, tipo, vigente_hasta);

-- La empresa del documento es la de su técnico; no cambia de técnico ni de archivo.
create or replace function public.tecnico_documento_valido()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.storage_path is distinct from old.storage_path
                           or new.tecnico_id is distinct from old.tecnico_id) then
    raise exception 'El documento no puede cambiar de técnico ni de archivo; sube uno nuevo';
  end if;
  select t.empresa_id into new.empresa_id from public.tecnicos t where t.id = new.tecnico_id;
  if new.empresa_id is null then
    raise exception 'El técnico no existe';
  end if;
  return new;
end;
$$;
revoke all on function public.tecnico_documento_valido() from public, anon, authenticated;

create trigger aa_tecnico_documento_valido before insert or update on public.tecnico_documentos
  for each row execute function public.tecnico_documento_valido();

alter table public.tecnico_documentos enable row level security;

-- Personal (no técnicos ni clientes) consulta; el técnico ve los suyos;
-- gestión sube y edita; solo Administrador borra.
create policy tecnico_documentos_select on public.tecnico_documentos for select to authenticated
  using ((public.is_staff() and not public.is_tecnico()) or tecnico_id = public.current_tecnico_id());
create policy tecnico_documentos_insert on public.tecnico_documentos for insert to authenticated
  with check (public.puede_gestionar_operacion());
create policy tecnico_documentos_update on public.tecnico_documentos for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());
create policy tecnico_documentos_delete on public.tecnico_documentos for delete to authenticated
  using (public.is_admin());
create policy tecnico_documentos_solo_empresa_activa on public.tecnico_documentos
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

-- Storage: subir a {empresa_activa}/tecnicos/{tecnico}/... en "expedientes".
create policy expedientes_tecnicos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and (storage.foldername(name))[1] = (select public.empresa_activa())::text
    and (storage.foldername(name))[2] = 'tecnicos'
    and exists (select 1 from public.tecnicos t
                 where t.id::text = (storage.foldername(name))[3]
                   and t.empresa_id = (select public.empresa_activa()))
    and public.puede_gestionar_operacion()
  );

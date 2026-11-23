-- Currículum de cada empresa para licitaciones y ComprasMX: presentación,
-- especialidades, infraestructura, certificaciones y la experiencia que no está
-- capturada como contrato en el sistema (contratos históricos). Los contratos del
-- sistema se agregan solos al currículum.
--
-- experiencia_externa: [{cliente, numero, objeto, inicio "AAAA-MM", fin "AAAA-MM",
--                        monto, evidencia}]   (evidencia: acta de aceptación,
--                        liberación de fianza… o "")
-- Cambio aditivo: tabla nueva con las mismas reglas que el expediente de la empresa.

create table public.empresa_curriculum (
  empresa_id uuid primary key references public.empresas(id),
  semblanza text not null default '',
  especialidades jsonb not null default '[]'::jsonb check (jsonb_typeof(especialidades) = 'array'),
  infraestructura text not null default '',
  certificaciones jsonb not null default '[]'::jsonb check (jsonb_typeof(certificaciones) = 'array'),
  experiencia_externa jsonb not null default '[]'::jsonb check (jsonb_typeof(experiencia_externa) = 'array'),
  actualizado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_touch_empresa_curriculum before update on public.empresa_curriculum
  for each row execute function public.touch_updated_at();

-- Toma la empresa activa si no se indica (misma función que el resto de las tablas).
create trigger aa_asignar_empresa before insert or update on public.empresa_curriculum
  for each row execute function public.asignar_empresa();

alter table public.empresa_curriculum enable row level security;

create policy empresa_curriculum_select on public.empresa_curriculum for select to authenticated
  using (public.is_staff() and not public.is_tecnico());
create policy empresa_curriculum_insert on public.empresa_curriculum for insert to authenticated
  with check (public.puede_gestionar_operacion());
create policy empresa_curriculum_update on public.empresa_curriculum for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());
create policy empresa_curriculum_delete on public.empresa_curriculum for delete to authenticated
  using (public.is_admin());
create policy empresa_curriculum_solo_empresa_activa on public.empresa_curriculum
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

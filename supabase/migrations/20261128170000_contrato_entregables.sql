-- Entregables por ficha técnica: lo que cada partida (o todo el contrato) pide
-- entregar (garantía de calidad por escrito, informe del servicio, resultados de
-- pruebas, plan de trabajo…), cuándo se entrega y con qué documento del
-- expediente quedó acreditado. Solo agrega una tabla; no cambia las existentes.

create table public.contrato_entregables (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  -- null = lo pide todo el contrato (no una partida en particular).
  partida_id uuid references public.contrato_partidas (id) on delete cascade,
  -- Opcional: la orden de servicio con la que se cumplió.
  orden_id uuid references public.ordenes_servicio (id) on delete set null,
  nombre text not null check (btrim(nombre) <> ''),
  momento text not null default 'Al concluir'
    check (momento in ('Antes de iniciar', 'Durante el servicio', 'Al concluir')),
  estado text not null default 'Pendiente'
    check (estado in ('Pendiente', 'Entregado', 'No aplica')),
  documento_id uuid references public.contrato_documentos (id) on delete set null,
  fecha_entrega date,
  notas text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contrato_entregables_contrato_idx on public.contrato_entregables (contrato_id, partida_id);
create index contrato_entregables_orden_idx on public.contrato_entregables (orden_id) where orden_id is not null;
create index contrato_entregables_documento_idx on public.contrato_entregables (documento_id) where documento_id is not null;

create trigger trg_touch_contrato_entregables before update on public.contrato_entregables
  for each row execute function public.touch_updated_at();

-- Empresa tomada del contrato; la partida, la orden y el documento deben ser del
-- mismo contrato.
create or replace function public.contrato_entregable_validar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  if tg_op = 'UPDATE' and (new.empresa_id is distinct from old.empresa_id
                           or new.contrato_id is distinct from old.contrato_id) then
    raise exception 'No se puede mover el entregable a otra empresa o contrato';
  end if;
  select empresa_id into v_empresa from public.contratos where id = new.contrato_id;
  if v_empresa is null then
    raise exception 'El contrato no existe';
  end if;
  if new.empresa_id is null then
    new.empresa_id := v_empresa;
  elsif new.empresa_id <> v_empresa then
    raise exception 'El entregable y su contrato pertenecen a empresas distintas';
  end if;
  if new.partida_id is not null and not exists (
    select 1 from public.contrato_partidas where id = new.partida_id and contrato_id = new.contrato_id
  ) then
    raise exception 'La partida no pertenece a este contrato';
  end if;
  if new.orden_id is not null and not exists (
    select 1 from public.ordenes_servicio where id = new.orden_id and contrato_id = new.contrato_id
  ) then
    raise exception 'La orden no pertenece a este contrato';
  end if;
  if new.documento_id is not null and not exists (
    select 1 from public.contrato_documentos where id = new.documento_id and contrato_id = new.contrato_id
  ) then
    raise exception 'El documento no pertenece al expediente de este contrato';
  end if;
  return new;
end;
$$;

create trigger aa_contrato_entregable_validar before insert or update on public.contrato_entregables
  for each row execute function public.contrato_entregable_validar();

revoke all on function public.contrato_entregable_validar() from public, anon, authenticated;

-- RLS igual que contratos: personal consulta, gestión crea y edita, solo
-- Administrador borra, y siempre solo la empresa activa.
alter table public.contrato_entregables enable row level security;

create policy contrato_entregables_select on public.contrato_entregables for select to authenticated
  using (public.is_staff() and not public.is_tecnico());
create policy contrato_entregables_insert on public.contrato_entregables for insert to authenticated
  with check (public.puede_gestionar_operacion());
create policy contrato_entregables_update on public.contrato_entregables for update to authenticated
  using (public.puede_gestionar_operacion())
  with check (public.puede_gestionar_operacion());
create policy contrato_entregables_delete on public.contrato_entregables for delete to authenticated
  using (public.is_admin());
create policy contrato_entregables_solo_empresa_activa on public.contrato_entregables
  as restrictive for all to authenticated
  using (empresa_id = (select public.empresa_activa()))
  with check (empresa_id = (select public.empresa_activa()));

-- Tickets / solicitudes de servicio de ZARAMAN
-- Un ticket es una solicitud de atención. Puede convertirse en una orden
-- directa; la cotización es un flujo separado y no es obligatoria para una
-- orden que el supervisor autorice directamente.

create sequence if not exists public.tickets_folio_seq;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  equipo_id uuid null references public.equipos(id) on delete set null,
  contacto text not null default '',
  ubicacion text not null default '',
  tipo_servicio text not null default 'Correctivo',
  prioridad text not null default 'Normal',
  estado text not null default 'Nuevo',
  descripcion_falla text not null default '',
  fecha_solicitud date not null default current_date,
  orden_id uuid null references public.ordenes_servicio(id) on delete set null,
  creado_por uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_prioridad_check check (prioridad in ('Baja','Normal','Alta','Urgente')),
  constraint tickets_estado_check check (estado in ('Nuevo','Revisado','Asignado','En atención','Pendiente','Resuelto','Cerrado','Cancelado'))
);

create index if not exists idx_tickets_cliente on public.tickets(cliente_id);
create index if not exists idx_tickets_equipo on public.tickets(equipo_id);
create index if not exists idx_tickets_orden on public.tickets(orden_id);
create index if not exists idx_tickets_estado on public.tickets(estado);

create or replace function public.generar_folio_ticket()
returns trigger
language plpgsql
as $$
begin
  if new.folio is null or btrim(new.folio) = '' then
    new.folio := 'TK-' || lpad(nextval('public.tickets_folio_seq')::text, 6, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tickets_folio on public.tickets;
create trigger trg_tickets_folio
before insert or update on public.tickets
for each row execute function public.generar_folio_ticket();

alter table public.tickets enable row level security;

drop policy if exists "tickets_select_authenticated" on public.tickets;
create policy "tickets_select_authenticated"
on public.tickets
for select
to authenticated
using (true);

drop policy if exists "tickets_insert_authenticated" on public.tickets;
create policy "tickets_insert_authenticated"
on public.tickets
for insert
to authenticated
with check (true);

drop policy if exists "tickets_update_authenticated" on public.tickets;
create policy "tickets_update_authenticated"
on public.tickets
for update
to authenticated
using (true)
with check (true);

drop policy if exists "tickets_delete_authenticated" on public.tickets;
create policy "tickets_delete_authenticated"
on public.tickets
for delete
to authenticated
using (true);

-- Asegura que la relación orden -> ticket exista aunque la columna ya hubiera
-- sido creada previamente por otra migración.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'ordenes_servicio_ticket_id_fkey'
       and conrelid = 'public.ordenes_servicio'::regclass
  ) then
    alter table public.ordenes_servicio
      add constraint ordenes_servicio_ticket_id_fkey
      foreign key (ticket_id) references public.tickets(id) on delete set null;
  end if;
end $$;

-- Sincroniza la secuencia con folios existentes si los hubiera.
do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(folio from '^TK-([0-9]+)$')::bigint), 0)
    into v_max
    from public.tickets;
  if v_max > 0 then
    perform setval('public.tickets_folio_seq', v_max, true);
  end if;
end $$;

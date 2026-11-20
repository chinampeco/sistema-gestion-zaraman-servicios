-- Bitácora de accesos: quién entró, cuándo, desde dónde y con qué dispositivo.
-- Solo el servidor (service role) escribe; solo el Administrador verificado lee.
-- Los registros no se pueden modificar y solo se borran pasado un año.

create table public.bitacora_accesos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  usuario_id uuid,            -- sin llave foránea: el registro se conserva aunque se borre la cuenta
  email text not null default '',
  nombre text not null default '',
  rol text not null default '',
  evento text not null check (evento in (
    'Inicio de sesión', 'Verificación en dos pasos', 'Cierre de sesión',
    'Cambio de contraseña', 'Contraseña restablecida', 'Verificación reiniciada', 'Bloqueo temporal'
  )),
  exito boolean not null default true,
  ip text not null default '',
  ubicacion text not null default '',
  dispositivo text not null default '',
  agente text not null default '',
  detalle text not null default '',
  nuevo_lugar boolean not null default false
);

create index bitacora_accesos_fecha_idx on public.bitacora_accesos (created_at desc);
create index bitacora_accesos_email_idx on public.bitacora_accesos (lower(email), created_at desc);
create index bitacora_accesos_usuario_idx on public.bitacora_accesos (usuario_id, created_at desc);

alter table public.bitacora_accesos enable row level security;
revoke all on public.bitacora_accesos from anon;
revoke insert, update, delete, truncate on public.bitacora_accesos from authenticated;

create policy bitacora_accesos_admin_select on public.bitacora_accesos
  for select to authenticated using (public.is_admin());

create or replace function public.bitacora_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.created_at < now() - interval '1 year' then
    return old;
  end if;
  raise exception 'La bitácora de accesos no se puede modificar.';
end;
$$;
revoke execute on function public.bitacora_inmutable() from public, anon, authenticated;

create trigger bitacora_inmutable
  before update or delete on public.bitacora_accesos
  for each row execute function public.bitacora_inmutable();

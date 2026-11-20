-- Una cuenta de técnico puede trabajar en varias empresas: cada ficha de
-- técnico (una por empresa) indica a qué cuenta pertenece, y current_tecnico_id()
-- devuelve la ficha de la empresa que el técnico tiene seleccionada.
alter table public.tecnicos
  add column usuario_id uuid references public.profiles(id) on delete set null;

-- Una cuenta tiene a lo más una ficha por empresa.
create unique index tecnicos_usuario_empresa_uq
  on public.tecnicos (usuario_id, empresa_id) where usuario_id is not null;

-- Fichas ya ligadas con el esquema anterior (profiles.tecnico_id).
update public.tecnicos t set usuario_id = p.id
  from public.profiles p where p.tecnico_id = t.id;

create or replace function public.current_tecnico_id()
returns uuid language sql stable security definer set search_path = public
as $$
  select t.id
    from public.tecnicos t
   where t.empresa_id = public.empresa_activa()
     and (t.usuario_id = auth.uid()
          or t.id = (select p.tecnico_id from public.profiles p where p.id = auth.uid()))
   order by (t.usuario_id = auth.uid()) desc nulls last
   limit 1
$$;

-- Solo el Administrador (o el servidor) liga una ficha con una cuenta.
create or replace function public.tecnico_usuario_protegido()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.usuario_id := null;
    elsif new.usuario_id is distinct from old.usuario_id then
      new.usuario_id := old.usuario_id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.tecnico_usuario_protegido() from public, anon, authenticated;

create trigger tecnico_usuario_protegido
  before insert or update on public.tecnicos
  for each row execute function public.tecnico_usuario_protegido();

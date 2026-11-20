-- Cambio obligatorio de contraseña: las cuentas que crea o restablece un
-- administrador (y los accesos al portal con la contraseña inicial) deben
-- cambiarla en su primer acceso. El usuario no puede quitarse la marca: solo
-- el servidor al cambiar la contraseña, o un Administrador.
alter table public.profiles
  add column debe_cambiar_password boolean not null default false;

create or replace function public.lock_profile_sensitive()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  -- Contexto de servidor (service role, auth.uid() nulo) o Administrador: sin restricción.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.rol := old.rol;
  new.activo := old.activo;
  new.tecnico_id := old.tecnico_id;
  new.cliente_id := old.cliente_id;
  new.debe_cambiar_password := old.debe_cambiar_password;
  return new;
end;
$function$;
revoke execute on function public.lock_profile_sensitive() from public, anon, authenticated;

-- Los accesos al portal existentes se crearon con la contraseña inicial.
update public.profiles set debe_cambiar_password = true where rol = 'Cliente';

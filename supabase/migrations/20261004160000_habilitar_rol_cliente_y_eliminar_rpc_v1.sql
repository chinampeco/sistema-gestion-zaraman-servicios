-- PENDIENTE DE APLICAR en producción: contiene sentencias destructivas
-- (DROP CONSTRAINT / DROP FUNCTION) que requieren confirmación explícita.
--
-- 1) Habilitar el rol 'cliente' en profiles.role. Se reemplaza el CHECK
--    completo; los cuatro roles existentes se conservan.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array['administrador', 'supervisor', 'tecnico', 'consulta', 'cliente']));

-- 2) La versión v1 de la RPC de asignación ya no se usa (el código llama a
--    asignar_orden_con_garantia_v2) y se elimina.
drop function if exists public.asignar_orden_con_garantia(
  uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text
);

notify pgrst, 'reload schema';

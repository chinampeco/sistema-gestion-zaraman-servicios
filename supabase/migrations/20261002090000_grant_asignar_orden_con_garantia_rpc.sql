-- Exponer la RPC atómica de asignación y garantía al Data API.
grant execute on function public.asignar_orden_con_garantia(
  uuid, uuid, jsonb, uuid, boolean, integer, text, text, text, text
) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

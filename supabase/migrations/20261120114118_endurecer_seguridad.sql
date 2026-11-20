-- Endurecimiento según el revisor de seguridad de Supabase:
-- funciones internas y de trigger sin acceso por API; funciones de sesión solo
-- para usuarios con sesión; políticas que aplicaban a "public" pasan a
-- "authenticated"; search_path fijo en funciones de fecha.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.lock_profile_sensitive() from public, anon, authenticated;
revoke execute on function public.trg_pago_recalc() from public, anon, authenticated;
revoke execute on function public.recalcular_factura(uuid) from public, anon, authenticated;

revoke execute on function public.current_cliente_id() from public, anon;
revoke execute on function public.current_tecnico_id() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_tecnico() from public, anon;
grant execute on function public.current_cliente_id() to authenticated;
grant execute on function public.current_tecnico_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_tecnico() to authenticated;

alter policy cotizaciones_cliente_select on public.cotizaciones to authenticated;
alter policy cotizaciones_staff_all on public.cotizaciones to authenticated;
alter policy facturas_staff_all on public.facturas to authenticated;
alter policy facturas_cliente_select on public.facturas to authenticated;
alter policy pagos_cliente_select on public.pagos to authenticated;
alter policy pagos_staff_all on public.pagos to authenticated;
alter policy profiles_update_own on public.profiles to authenticated;

alter function public.touch_updated_at() set search_path = '';
alter function public.set_updated_at() set search_path = '';

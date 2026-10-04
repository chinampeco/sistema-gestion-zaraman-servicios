-- Exponer explícitamente orden_garantias al Data API de Supabase.
-- Desde 2026 las tablas nuevas en public requieren GRANT explícito.
grant select on public.orden_garantias to anon;
grant select, insert, update, delete on public.orden_garantias to authenticated;
grant select, insert, update, delete on public.orden_garantias to service_role;
grant usage on schema public to anon, authenticated, service_role;

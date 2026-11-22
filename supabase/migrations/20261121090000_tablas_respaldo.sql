-- Lista de tablas para el respaldo descargable (con su llave primaria para
-- leerlas en orden). Solo la puede usar el servidor (service role).
create or replace function public.tablas_respaldo()
returns table (nombre text, llave text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text,
         (select a.attname::text
            from pg_catalog.pg_index i
            join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
           where i.indrelid = c.oid and i.indisprimary)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p')
   order by c.relname
$$;
revoke execute on function public.tablas_respaldo() from public, anon, authenticated;
grant execute on function public.tablas_respaldo() to service_role;

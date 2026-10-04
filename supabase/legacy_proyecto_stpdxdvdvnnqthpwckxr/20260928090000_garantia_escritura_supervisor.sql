-- La configuración de la garantía comercial se realiza al asignar técnico.
-- Técnicos y consultas solo pueden visualizarla.

drop policy if exists "orden_garantias_write_internal" on public.orden_garantias;

create policy "orden_garantias_write_internal"
on public.orden_garantias
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('administrador', 'coordinador', 'supervisor')
      and coalesce(p.active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('administrador', 'coordinador', 'supervisor')
      and coalesce(p.active, true) = true
  )
);

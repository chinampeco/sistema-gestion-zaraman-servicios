drop policy if exists "orden_garantias_write_internal" on public.orden_garantias;
drop policy if exists "orden_garantias_write_supervision" on public.orden_garantias;

create policy "orden_garantias_write_supervision"
on public.orden_garantias
for all
to authenticated
using (
  (select private.current_user_role()) = any (array['administrador','coordinador','supervisor'])
)
with check (
  (select private.current_user_role()) = any (array['administrador','coordinador','supervisor'])
);
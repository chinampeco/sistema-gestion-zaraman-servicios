-- Base real: ynpvetdujkpxuaplsona.
-- Solo Administrador, Coordinador y Supervisor activos pueden insertar en
-- whatsapp_mensajes (mensajes salientes y notas internas).
-- Es una política RESTRICTIVA: se suma (AND) a la permisiva existente
-- whatsapp_mensajes_staff_all sin modificarla. Lectura y actualización
-- (marcar como leído) no cambian. El webhook usa service role y no se afecta.
-- Aditiva: no borra ni altera políticas ni datos.

create policy whatsapp_mensajes_insert_solo_gestion
on public.whatsapp_mensajes
as restrictive
for insert
to authenticated
with check (public.puede_gestionar_operacion());

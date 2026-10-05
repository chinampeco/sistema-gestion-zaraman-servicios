-- Base real: ynpvetdujkpxuaplsona.
-- Un mensaje de WhatsApp (wamid) solo se guarda una vez: Meta reintenta los
-- webhooks y sin esto cada reintento duplicaría el mensaje. El webhook hace
-- upsert ... on conflict (whatsapp_message_id) do nothing.
-- Las filas sin wamid (notas internas, salientes pendientes) no chocan entre
-- sí porque en un índice único los NULL son distintos.
-- Aditiva: al momento de escribirla la tabla no tiene wamid duplicados.

create unique index if not exists whatsapp_mensajes_whatsapp_message_id_key
  on public.whatsapp_mensajes (whatsapp_message_id);

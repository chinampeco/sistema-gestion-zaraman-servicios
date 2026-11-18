-- Aplicada el 18/11/2026 desde el SQL Editor de Supabase (no queda en schema_migrations).
-- Fotos de evidencia privadas: el bucket deja de ser público y solo puede leer
-- una foto quien puede ver su orden (la carpeta es el id de la orden; la
-- consulta a ordenes_servicio respeta sus reglas: personal de la empresa
-- activa, técnico asignado o cliente dueño). Antes cualquiera podía leerlas.
update storage.buckets set public = false where id = 'evidencias';

drop policy if exists evidencias_select on storage.objects;
create policy evidencias_select on storage.objects for select to authenticated
using (
  bucket_id = 'evidencias'
  and exists (
    select 1 from public.ordenes_servicio o
     where o.id::text = (storage.foldername(objects.name))[1]
  )
);

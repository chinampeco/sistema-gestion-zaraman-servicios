-- Cierre de la orden con firma del área usuaria (nombre) y del área técnica, y
-- liga al escaneo firmado de las órdenes que se suben como historial.
-- Solo agrega columnas.
alter table public.ordenes_servicio
  add column firma_cliente_nombre text,
  add column firma_area_tecnica text,
  add column firma_area_tecnica_nombre text,
  add column firma_area_tecnica_fecha timestamptz,
  add column documento_firmado_id uuid references public.contrato_documentos(id) on delete set null;

create index ordenes_servicio_documento_firmado_idx on public.ordenes_servicio (documento_firmado_id);

-- La TOL-OS-000001 queda ligada al escaneo que ya se subió.
update public.ordenes_servicio o
   set documento_firmado_id = d.id
  from public.contrato_documentos d
 where o.folio = 'TOL-OS-000001'
   and d.contrato_id = o.contrato_id
   and d.nombre_archivo = '111.pdf';

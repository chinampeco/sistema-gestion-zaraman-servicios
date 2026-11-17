-- Ficha del técnico: si tiene cédula profesional y observaciones (fortalezas,
-- si puede ser encargado de brigada, etc.). Solo agrega columnas.
alter table public.tecnicos
  add column tiene_cedula boolean not null default false,
  add column notas text;

-- Lectura con IA en segundo plano: el resultado (o el error) se guarda en el
-- documento para no perderlo si la conexión del navegador se corta o si la
-- respuesta tarda más que el límite de la función.
--   {"estado": "leyendo", "inicio": "..."}
--   {"estado": "lista", "fin": "...", "lectura": {...}}
--   {"estado": "error", "fin": "...", "error": "..."}
-- Cambio aditivo: una columna nueva, sin tocar datos existentes.
alter table public.licitacion_documentos add column lectura jsonb;

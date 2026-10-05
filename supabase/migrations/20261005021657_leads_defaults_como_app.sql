-- Base real: ynpvetdujkpxuaplsona.
-- Los defaults de leads estaban en minúscula ('nuevo', 'normal'), pero la app
-- escribe y filtra con mayúscula inicial ('Nuevo', 'Normal'; ver leadToDb y
-- ESTADOS_LEAD / PRIORIDADES_LEAD en lib/types.ts). Un lead insertado sin
-- estado quedaba fuera de la columna "Nuevo" del tablero.
-- Solo cambia el valor por defecto de filas futuras; no modifica filas existentes.

alter table public.leads alter column estado set default 'Nuevo';
alter table public.leads alter column prioridad set default 'Normal';

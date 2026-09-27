# Corrección: mostrar nombres en lugar de UUID en selecciones

Se corrigió el comportamiento de los Select de relaciones cuando el valor guardado ya no aparece en la lista filtrada de opciones. Base UI muestra el valor crudo (UUID) cuando no encuentra un SelectItem coincidente.

Cambios principales:
- Leads: el responsable actualmente guardado se conserva en las opciones aunque esté inactivo o haya cambiado de rol.
- Cotizaciones: el equipo actualmente guardado se conserva aunque la relación ya no coincida con el filtro del cliente.
- Órdenes: el equipo y técnico actualmente guardados se conservan para que el selector muestre su nombre.
- Tickets: el equipo actualmente guardado se conserva.
- Se documentó el motivo en `components/ui/select.tsx`.

No se modificó la base de datos ni se eliminaron registros.

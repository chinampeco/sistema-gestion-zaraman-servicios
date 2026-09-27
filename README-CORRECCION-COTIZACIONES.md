# Corrección de diagnóstico de cotizaciones

Cambios realizados:

1. `lib/store.tsx`
   - La creación de cotizaciones ahora registra el error real de Supabase en consola.
   - El mensaje de interfaz incluye temporalmente `error.message` cuando Supabase devuelve un error.
   - Se agregó `tecnicoId: null` al usuario placeholder para satisfacer el tipo `Usuario`.

2. `components/cotizaciones/cotizacion-form-dialog.tsx`
   - El submit ahora espera (`await`) la creación/actualización.
   - Si crear una cotización falla, el diálogo no se cierra y se conserva la información capturada.
   - El formulario solo se cierra cuando la operación termina correctamente.

No se modificó la base de datos ni se ejecutó ninguna operación contra Supabase.

## Siguiente prueba

1. Sustituir estos archivos en el proyecto.
2. Abrir `Nueva cotización`.
3. Capturar una cotización de prueba.
4. Guardar una sola vez.
5. Si falla, copiar el mensaje exacto que aparezca después de `Error al crear cotización:`.

No eliminar ni modificar `COT-000001` durante esta prueba.

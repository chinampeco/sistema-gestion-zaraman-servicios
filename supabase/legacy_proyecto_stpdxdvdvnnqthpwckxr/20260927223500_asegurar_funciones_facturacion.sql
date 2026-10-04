alter function public.trg_factura_inicializar_saldo() set search_path = public;
revoke execute on function public.recalcular_factura_pago(uuid) from public, anon, authenticated;
revoke execute on function public.trg_recalcular_factura_desde_pago() from public, anon, authenticated;
revoke execute on function public.trg_validar_pago_factura() from public, anon, authenticated;
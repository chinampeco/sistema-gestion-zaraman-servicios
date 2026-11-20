import type { SupabaseClient } from "@supabase/supabase-js"

/** Deja constancia en la bitácora (sin esperar si falla) y cierra la sesión. */
export async function cerrarSesion(supabase: SupabaseClient) {
  await fetch("/api/bitacora", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento: "Cierre de sesión" }),
  }).catch(() => null)
  await supabase.auth.signOut()
}

export function registrarEventoSesion(evento: "Verificación en dos pasos", exito: boolean) {
  void fetch("/api/bitacora", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ evento, exito }),
  }).catch(() => null)
}

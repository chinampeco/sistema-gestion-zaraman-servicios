// Acceso a una orden desde las rutas API: se consulta con la sesión del usuario
// para que las reglas de la base (RLS) decidan si la puede ver (personal de la
// empresa activa, técnico asignado o cliente dueño). Solo después se usa la
// llave de servicio para leer lo relacionado (contrato, archivos).

import { createClient } from "@/lib/supabase/server"
import { esUuid } from "@/lib/importacion-servidor"

export type AccesoOrden =
  | { ok: true; ordenId: string }
  | { ok: false; status: 400 | 401 | 404; error: string }

export async function accesoOrden(id: unknown): Promise<AccesoOrden> {
  if (!esUuid(id)) return { ok: false, status: 400, error: "Orden inválida." }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "No autenticado." }
  const { data } = await supabase.from("ordenes_servicio").select("id").eq("id", id).maybeSingle()
  if (!data) return { ok: false, status: 404, error: "La orden no existe o no tienes acceso." }
  return { ok: true, ordenId: id }
}

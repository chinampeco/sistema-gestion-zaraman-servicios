import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { BUCKET_EXPEDIENTES } from "@/lib/contratos"

// Roles que pueden capturar contratos (igual que puede_gestionar_operacion()).
const ROLES_GESTION = ["Administrador", "Coordinador", "Supervisor"]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor)
}

export function adminClient() {
  return createAdminClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type Sesion =
  | { ok: true; userId: string; empresaId: string }
  | { ok: false; status: 401 | 403; error: string }

/** Usuario en sesión con rol de gestión y empresa activa seleccionada. */
export async function requerirGestor(): Promise<Sesion> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: "No autenticado." }

  const [{ data: perfil }, { data: empresaId }] = await Promise.all([
    supabase.from("profiles").select("rol, activo").eq("id", user.id).single(),
    supabase.rpc("empresa_activa"),
  ])
  if (!perfil || !perfil.activo || !ROLES_GESTION.includes(perfil.rol)) {
    return { ok: false, status: 403, error: "Tu rol no puede registrar contratos." }
  }
  if (!esUuid(empresaId)) {
    return { ok: false, status: 403, error: "Selecciona una empresa antes de continuar." }
  }
  return { ok: true, userId: user.id, empresaId }
}

/** Carpeta temporal de un lote: {empresa}/importaciones/{lote}. */
export function carpetaLote(empresaId: string, lote: string): string {
  return `${empresaId}/importaciones/${lote}`
}

/** Borra todos los archivos temporales de un lote (con la llave de servicio). */
export async function borrarLote(empresaId: string, lote: string): Promise<void> {
  const admin = adminClient()
  const carpeta = carpetaLote(empresaId, lote)
  const { data } = await admin.storage.from(BUCKET_EXPEDIENTES).list(carpeta, { limit: 100 })
  const rutas = (data ?? []).map((f) => `${carpeta}/${f.name}`)
  if (rutas.length) await admin.storage.from(BUCKET_EXPEDIENTES).remove(rutas)
}

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

// Estado de una lectura con IA que corre en segundo plano, guardado junto a los
// archivos del lote. El bucket solo admite tipos de documento, así que el JSON
// viaja en base64 dentro de un XML pequeño. El nombre empieza con "_" para que
// no se confunda con los archivos numerados del lote.
const ARCHIVO_ESTADO = "_estado.xml"

export async function guardarEstadoLote(empresaId: string, lote: string, estado: Record<string, unknown>): Promise<void> {
  const xml = `<estado>${Buffer.from(JSON.stringify(estado), "utf8").toString("base64")}</estado>`
  await adminClient()
    .storage.from(BUCKET_EXPEDIENTES)
    .upload(`${carpetaLote(empresaId, lote)}/${ARCHIVO_ESTADO}`, new Blob([xml], { type: "text/xml" }), {
      contentType: "text/xml",
      upsert: true,
    })
}

export async function leerEstadoLote(empresaId: string, lote: string): Promise<Record<string, unknown> | null> {
  const { data } = await adminClient()
    .storage.from(BUCKET_EXPEDIENTES)
    .download(`${carpetaLote(empresaId, lote)}/${ARCHIVO_ESTADO}`)
  if (!data) return null
  const m = /<estado>([A-Za-z0-9+/=]*)<\/estado>/.exec(await data.text())
  if (!m) return null
  try {
    return JSON.parse(Buffer.from(m[1], "base64").toString("utf8"))
  } catch {
    return null
  }
}

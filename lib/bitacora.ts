// Bitácora de accesos (solo servidor). Guarda IP, ubicación aproximada (la
// que Vercel calcula por IP) y dispositivo de cada evento de acceso.
import { adminClient } from "@/lib/importacion-servidor"

export type EventoBitacora =
  | "Inicio de sesión"
  | "Verificación en dos pasos"
  | "Cierre de sesión"
  | "Cambio de contraseña"
  | "Contraseña restablecida"
  | "Verificación reiniciada"
  | "Bloqueo temporal"

/** Intentos fallidos permitidos por correo antes de bloquear un rato. */
export const MAX_INTENTOS = 5
export const MINUTOS_BLOQUEO = 15

function decodificar(v: string | null): string {
  if (!v) return ""
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

export function datosConexion(headers: Headers) {
  const ip = (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "").trim()
  const ubicacion = [
    decodificar(headers.get("x-vercel-ip-city")),
    decodificar(headers.get("x-vercel-ip-country-region")),
    decodificar(headers.get("x-vercel-ip-country")),
  ]
    .filter(Boolean)
    .join(", ")
  const agente = (headers.get("user-agent") ?? "").slice(0, 400)
  return { ip, ubicacion, agente, dispositivo: describirDispositivo(agente) }
}

export function describirDispositivo(ua: string): string {
  if (!ua) return ""
  const navegador = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua) || /CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navegador"
  const sistema = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "otro sistema"
  return `${navegador} en ${sistema}`
}

interface Registro {
  evento: EventoBitacora
  exito?: boolean
  usuarioId?: string | null
  email?: string
  detalle?: string
}

/** Guarda un evento. Nunca lanza error: la bitácora no debe impedir el acceso. */
export async function registrarAcceso(headers: Headers, r: Registro): Promise<{ nuevoLugar: boolean }> {
  try {
    const admin = adminClient()
    const conexion = datosConexion(headers)
    let nombre = ""
    let rol = ""
    let email = (r.email ?? "").trim().toLowerCase()
    if (r.usuarioId) {
      const { data: p } = await admin
        .from("profiles")
        .select("nombre_completo, rol, email")
        .eq("id", r.usuarioId)
        .maybeSingle()
      nombre = p?.nombre_completo ?? ""
      rol = p?.rol ?? ""
      email = email || (p?.email ?? "").toLowerCase()
    }

    // Inicio exitoso desde un dispositivo o lugar que esa cuenta no había usado.
    let nuevoLugar = false
    if (r.evento === "Inicio de sesión" && r.exito !== false && r.usuarioId) {
      const { data: previos } = await admin
        .from("bitacora_accesos")
        .select("dispositivo, ubicacion")
        .eq("usuario_id", r.usuarioId)
        .eq("evento", "Inicio de sesión")
        .eq("exito", true)
        .order("created_at", { ascending: false })
        .limit(200)
      if (previos && previos.length > 0) {
        nuevoLugar = !previos.some(
          (p) => p.dispositivo === conexion.dispositivo && p.ubicacion === conexion.ubicacion,
        )
      }
    }

    await admin.from("bitacora_accesos").insert({
      usuario_id: r.usuarioId ?? null,
      email,
      nombre,
      rol,
      evento: r.evento,
      exito: r.exito ?? true,
      ip: conexion.ip,
      ubicacion: conexion.ubicacion,
      dispositivo: conexion.dispositivo,
      agente: conexion.agente,
      detalle: (r.detalle ?? "").slice(0, 500),
      nuevo_lugar: nuevoLugar,
    })
    return { nuevoLugar }
  } catch {
    return { nuevoLugar: false }
  }
}

/** ¿El correo superó los intentos fallidos recientes? */
export async function correoBloqueado(email: string): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - MINUTOS_BLOQUEO * 60_000).toISOString()
    const { count } = await adminClient()
      .from("bitacora_accesos")
      .select("id", { count: "exact", head: true })
      .eq("email", email.trim().toLowerCase())
      .eq("evento", "Inicio de sesión")
      .eq("exito", false)
      .gte("created_at", desde)
    return (count ?? 0) >= MAX_INTENTOS
  } catch {
    return false
  }
}

import { createClient } from "@/lib/supabase/server"

// Configuración y control de acceso compartidos por las rutas /api/whatsapp.
// Solo se importa desde rutas API (lee variables de entorno secretas).

// Versión vigente de la Graph API al escribir esto (v26.0, julio de 2026).
// Se puede cambiar sin tocar código con WHATSAPP_API_VERSION.
const VERSION_API_POR_DEFECTO = "v26.0"

export function configWhatsApp() {
  const token = process.env.WHATSAPP_TOKEN || null
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null
  return {
    token,
    phoneNumberId,
    apiVersion: process.env.WHATSAPP_API_VERSION || VERSION_API_POR_DEFECTO,
    appSecret: process.env.WHATSAPP_APP_SECRET || null,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || null,
    envioConfigurado: Boolean(token && phoneNumberId),
  }
}

// Solo estos roles pueden enviar por WhatsApp y consultar la configuración.
const ROLES_WHATSAPP = ["Administrador", "Coordinador", "Supervisor"]

type Autorizado = {
  ok: true
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
}
type Rechazado = { ok: false; response: Response }

/** Exige sesión y un perfil activo con rol Administrador, Coordinador o Supervisor. */
export async function autorizarWhatsApp(): Promise<Autorizado | Rechazado> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: Response.json({ error: "No autorizado." }, { status: 401 }) }
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol, activo")
    .eq("id", user.id)
    .maybeSingle()

  if (!perfil || !perfil.activo || !ROLES_WHATSAPP.includes(perfil.rol)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Tu rol no tiene permiso para usar WhatsApp." },
        { status: 403 },
      ),
    }
  }

  return { ok: true, supabase, userId: user.id }
}

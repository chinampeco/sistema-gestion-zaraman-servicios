import { createClient } from "@/lib/supabase/server"

// Reporta si la integración de WhatsApp Business está configurada, para que
// la bandeja muestre "Configuración pendiente" sin exponer credenciales.

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "No autorizado." }, { status: 401 })
  }

  const configurado = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  )
  const webhookConfigurado = Boolean(process.env.WHATSAPP_VERIFY_TOKEN)

  return Response.json({ configurado, webhookConfigurado })
}

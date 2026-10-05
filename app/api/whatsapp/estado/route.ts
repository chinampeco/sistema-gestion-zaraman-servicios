import { autorizarWhatsApp, configWhatsApp } from "@/lib/whatsapp-server"

// Reporta si la integración de WhatsApp Business está configurada, para que
// la bandeja muestre "Configuración pendiente" sin exponer credenciales.
// Solo Administrador, Coordinador y Supervisor activos.

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await autorizarWhatsApp()
  if (!auth.ok) return auth.response

  const config = configWhatsApp()
  return Response.json({
    configurado: config.envioConfigurado,
    webhookConfigurado: Boolean(config.verifyToken && config.appSecret),
  })
}

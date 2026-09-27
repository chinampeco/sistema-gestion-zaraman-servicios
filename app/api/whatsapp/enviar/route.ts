import { createClient } from "@/lib/supabase/server"

// Envío de mensajes salientes de WhatsApp desde la bandeja interna.
// Persiste el mensaje con la sesión del usuario (RLS aplica) y, si las
// credenciales de la API de WhatsApp Business están configuradas, lo envía.
// Sin credenciales, guarda el mensaje como "pendiente" y avisa que la
// configuración está pendiente, sin romper el flujo.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "No autorizado." }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const telefono: string = (body?.telefono ?? "").toString().trim()
  const mensaje: string = (body?.mensaje ?? "").toString().trim()
  const leadId: string | null = body?.leadId ?? null
  const clienteId: string | null = body?.clienteId ?? null

  if (!telefono || !mensaje) {
    return Response.json({ error: "Teléfono y mensaje son obligatorios." }, { status: 400 })
  }

  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const configurado = Boolean(token && phoneNumberId)

  let whatsappMessageId: string | null = null
  let estado = "pendiente"
  let errorEnvio: string | null = null

  if (configurado) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: telefono,
            type: "text",
            text: { body: mensaje },
          }),
        },
      )
      const data = await res.json().catch(() => null)
      if (res.ok) {
        whatsappMessageId = data?.messages?.[0]?.id ?? null
        estado = "enviado"
      } else {
        errorEnvio = data?.error?.message ?? "La API de WhatsApp rechazó el envío."
        estado = "fallido"
      }
    } catch (error) {
      errorEnvio = (error as Error).message
      estado = "fallido"
    }
  }

  const { data: row, error } = await supabase
    .from("whatsapp_mensajes")
    .insert({
      lead_id: leadId,
      cliente_id: clienteId,
      telefono,
      direccion: "saliente",
      tipo: "texto",
      mensaje,
      whatsapp_message_id: whatsappMessageId,
      estado,
      leido: true,
      enviado_por: user.id,
    })
    .select("*")
    .single()

  if (error || !row) {
    return Response.json({ error: "No se pudo guardar el mensaje." }, { status: 500 })
  }

  return Response.json({
    mensaje: row,
    configurado,
    estado,
    error: errorEnvio,
  })
}

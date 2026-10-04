import { normalizarTelefonoEnvio } from "@/lib/whatsapp"
import { autorizarWhatsApp, configWhatsApp } from "@/lib/whatsapp-server"

// Envío de mensajes salientes de WhatsApp desde la bandeja interna.
// Solo Administrador, Coordinador y Supervisor activos. El mensaje se guarda
// primero (con la sesión del usuario, RLS aplica) y después se envía a Meta;
// el resultado actualiza su estado. Sin credenciales queda como "pendiente".

export const dynamic = "force-dynamic"

const MAX_LARGO_MENSAJE = 4096

export async function POST(request: Request) {
  const auth = await autorizarWhatsApp()
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth

  let body: any
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido." }, { status: 400 })
  }

  const telefono = normalizarTelefonoEnvio((body?.telefono ?? "").toString())
  const mensaje: string = (body?.mensaje ?? "").toString().trim()
  const leadId: string | null = body?.leadId || null
  const clienteId: string | null = body?.clienteId || null

  if (!telefono) {
    return Response.json(
      { error: "Teléfono inválido. Usa 10 dígitos o el formato internacional." },
      { status: 400 },
    )
  }
  if (!mensaje) {
    return Response.json({ error: "El mensaje es obligatorio." }, { status: 400 })
  }
  if (mensaje.length > MAX_LARGO_MENSAJE) {
    return Response.json(
      { error: `El mensaje no puede pasar de ${MAX_LARGO_MENSAJE} caracteres.` },
      { status: 400 },
    )
  }

  if (leadId) {
    const { data } = await supabase.from("leads").select("id").eq("id", leadId).maybeSingle()
    if (!data) return Response.json({ error: "El lead indicado no existe." }, { status: 400 })
  }
  if (clienteId) {
    const { data } = await supabase.from("clientes").select("id").eq("id", clienteId).maybeSingle()
    if (!data) return Response.json({ error: "El cliente indicado no existe." }, { status: 400 })
  }

  // 1) Guardar antes de enviar: nunca sale un mensaje que no quede registrado.
  const { data: guardado, error: errorGuardar } = await supabase
    .from("whatsapp_mensajes")
    .insert({
      lead_id: leadId,
      cliente_id: clienteId,
      telefono,
      direccion: "saliente",
      tipo: "texto",
      mensaje,
      estado: "pendiente",
      leido: true,
      enviado_por: userId,
    })
    .select("*")
    .single()

  if (errorGuardar || !guardado) {
    return Response.json({ error: "No se pudo guardar el mensaje." }, { status: 500 })
  }

  const config = configWhatsApp()
  if (!config.envioConfigurado) {
    return Response.json({ mensaje: guardado, configurado: false, estado: "pendiente", error: null })
  }

  // 2) Enviar a Meta.
  let estado = "fallido"
  let whatsappMessageId: string | null = null
  let errorEnvio: string | null = null
  try {
    const res = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
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
    }
  } catch (error) {
    errorEnvio = (error as Error).message
  }

  // 3) Actualizar el registro con el resultado.
  const { data: actualizado } = await supabase
    .from("whatsapp_mensajes")
    .update({ estado, whatsapp_message_id: whatsappMessageId })
    .eq("id", guardado.id)
    .select("*")
    .single()

  return Response.json({
    mensaje: actualizado ?? { ...guardado, estado, whatsapp_message_id: whatsappMessageId },
    configurado: true,
    estado,
    error: errorEnvio,
  })
}

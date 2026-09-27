import { createClient } from "@supabase/supabase-js"

// Webhook de WhatsApp Business Platform (Meta Cloud API).
// - GET: verificación del webhook (hub.challenge) al registrarlo en Meta.
// - POST: recepción de mensajes entrantes y actualizaciones de estado.
//
// Usa el service role para escribir sin sesión de usuario (RLS lo omite).
// Mientras falten las credenciales, el endpoint responde de forma segura
// sin romper: la verificación falla con 403 y la recepción se ignora.

export const dynamic = "force-dynamic"

function servicio() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// GET: Meta envía hub.mode, hub.verify_token y hub.challenge.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    // Configuración pendiente: no hay token con el cual verificar.
    return new Response("WhatsApp no configurado.", { status: 503 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 })
  }
  return new Response("Verificación fallida.", { status: 403 })
}

// POST: eventos entrantes de WhatsApp.
export async function POST(request: Request) {
  let payload: any
  try {
    payload = await request.json()
  } catch {
    return new Response("Cuerpo inválido.", { status: 400 })
  }

  const db = servicio()
  if (!db) {
    // Acknowledgment 200 para que Meta no reintente indefinidamente,
    // pero no hay dónde persistir hasta configurar las credenciales.
    return Response.json({ ok: true, stored: false })
  }

  try {
    const entradas = payload?.entry ?? []
    for (const entry of entradas) {
      for (const cambio of entry?.changes ?? []) {
        const value = cambio?.value ?? {}

        // 1) Mensajes entrantes.
        for (const msg of value?.messages ?? []) {
          const telefono: string = msg.from ?? ""
          if (!telefono) continue

          const tipo = msg.type as string
          let texto = ""
          let mediaUrl: string | null = null
          let tipoApp = "texto"

          if (tipo === "text") {
            texto = msg.text?.body ?? ""
          } else if (tipo === "image") {
            tipoApp = "imagen"
            texto = msg.image?.caption ?? "[Imagen]"
            mediaUrl = msg.image?.id ?? null
          } else if (tipo === "document") {
            tipoApp = "documento"
            texto = msg.document?.filename ?? "[Documento]"
            mediaUrl = msg.document?.id ?? null
          } else {
            texto = `[${tipo ?? "mensaje"}]`
          }

          // Vincula con lead/cliente existente por teléfono (si aplica).
          const [{ data: lead }, { data: cliente }] = await Promise.all([
            db.from("leads").select("id").eq("telefono", telefono).limit(1).maybeSingle(),
            db.from("clientes").select("id").eq("telefono", telefono).limit(1).maybeSingle(),
          ])

          await db.from("whatsapp_mensajes").insert({
            lead_id: lead?.id ?? null,
            cliente_id: cliente?.id ?? null,
            telefono,
            direccion: "entrante",
            tipo: tipoApp,
            mensaje: texto,
            media_url: mediaUrl,
            whatsapp_message_id: msg.id ?? null,
            estado: "recibido",
            leido: false,
          })
        }

        // 2) Actualizaciones de estado (enviado/entregado/leído/fallido).
        for (const st of value?.statuses ?? []) {
          const wamid = st.id
          const estado = st.status // sent | delivered | read | failed
          if (!wamid || !estado) continue
          const mapEstado: Record<string, string> = {
            sent: "enviado",
            delivered: "entregado",
            read: "leido",
            failed: "fallido",
          }
          await db
            .from("whatsapp_mensajes")
            .update({ estado: mapEstado[estado] ?? "enviado" })
            .eq("whatsapp_message_id", wamid)
        }
      }
    }
  } catch (error) {
    console.log("[v0] Error en webhook de WhatsApp:", (error as Error).message)
  }

  // Siempre 200 para confirmar recepción a Meta.
  return Response.json({ ok: true })
}

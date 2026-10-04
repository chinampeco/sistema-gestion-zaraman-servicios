import { createHmac, timingSafeEqual } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { claveTelefono, patronUltimosDigitos } from "@/lib/whatsapp"
import { configWhatsApp } from "@/lib/whatsapp-server"

// Webhook de WhatsApp Business Platform (Meta Cloud API).
// - GET: verificación del webhook (hub.challenge) al registrarlo en Meta.
// - POST: mensajes entrantes y actualizaciones de estado. Solo se procesa si
//   la firma X-Hub-Signature-256 coincide con WHATSAPP_APP_SECRET y el evento
//   es de nuestro número (WHATSAPP_PHONE_NUMBER_ID).
//
// Usa el service role para escribir sin sesión de usuario (RLS lo omite).

export const dynamic = "force-dynamic"

function servicio() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Compara la firma de Meta (sha256=<hex>) con el HMAC del cuerpo crudo, en tiempo constante. */
function firmaValida(cuerpo: string, firma: string | null, secreto: string): boolean {
  if (!firma?.startsWith("sha256=")) return false
  const esperada = createHmac("sha256", secreto).update(cuerpo, "utf8").digest()
  let recibida: Buffer
  try {
    recibida = Buffer.from(firma.slice("sha256=".length), "hex")
  } catch {
    return false
  }
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
}

// GET: Meta envía hub.mode, hub.verify_token y hub.challenge.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const { verifyToken } = configWhatsApp()
  if (!verifyToken) {
    return new Response("WhatsApp no configurado.", { status: 503 })
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } })
  }
  return new Response("Verificación fallida.", { status: 403 })
}

// Orden de los estados de un mensaje saliente: nunca se retrocede (Meta puede
// entregar "delivered" después de "read").
const RANGO_ESTADO: Record<string, number> = {
  pendiente: 0,
  enviado: 1,
  fallido: 2,
  entregado: 3,
  leido: 4,
}
const ESTADO_META: Record<string, string> = {
  sent: "enviado",
  delivered: "entregado",
  read: "leido",
  failed: "fallido",
}

/** Busca por los últimos 10 dígitos un registro de leads o clientes con ese teléfono. */
async function buscarPorTelefono(
  db: SupabaseClient,
  tabla: "leads" | "clientes",
  telefono: string,
): Promise<string | null> {
  const clave = claveTelefono(telefono)
  if (!clave) return null
  const { data, error } = await db
    .from(tabla)
    .select("id, telefono")
    .ilike("telefono", patronUltimosDigitos(telefono))
    .order("created_at", { ascending: true })
    .limit(50)
  if (error) throw new Error(`No se pudo buscar en ${tabla}: ${error.message}`)
  return data?.find((r) => claveTelefono(r.telefono) === clave)?.id ?? null
}

async function procesarMensaje(db: SupabaseClient, msg: any, contactos: any[]) {
  const telefono: string = msg?.from ?? ""
  const wamid: string | null = msg?.id ?? null
  if (!telefono || !wamid) return

  // Reintento de Meta: si ya lo guardamos, no se vuelve a procesar (ni se crea otro lead).
  const { data: existente } = await db
    .from("whatsapp_mensajes")
    .select("id")
    .eq("whatsapp_message_id", wamid)
    .maybeSingle()
  if (existente) return

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

  const [clienteId, leadExistente] = await Promise.all([
    buscarPorTelefono(db, "clientes", telefono),
    buscarPorTelefono(db, "leads", telefono),
  ])

  // Número desconocido: se registra como lead nuevo de origen WhatsApp.
  let leadId = leadExistente
  if (!clienteId && !leadId) {
    const nombrePerfil: string | undefined = contactos.find((c) => c?.wa_id === telefono)?.profile?.name
    const { data: nuevo, error } = await db
      .from("leads")
      .insert({
        nombre: nombrePerfil?.trim() || `WhatsApp +${telefono}`,
        telefono,
        origen: "WhatsApp",
        medio: "WhatsApp",
        estado: "Nuevo",
        prioridad: "Normal",
        descripcion_necesidad: tipo === "text" ? texto.slice(0, 500) : null,
        ultimo_contacto: new Date().toISOString(),
        notas: "Creado automáticamente por un mensaje entrante de WhatsApp.",
      })
      .select("id")
      .single()
    if (error || !nuevo) throw new Error(`No se pudo crear el lead: ${error?.message}`)
    leadId = nuevo.id
    await db.from("lead_actividades").insert({
      lead_id: leadId,
      tipo: "WhatsApp",
      descripcion: "Lead creado a partir de un mensaje entrante de WhatsApp.",
    })
  }

  // ignoreDuplicates: si dos entregas llegan a la vez, el índice único evita el doble registro.
  const { error } = await db.from("whatsapp_mensajes").upsert(
    {
      lead_id: leadId,
      cliente_id: clienteId,
      telefono,
      direccion: "entrante",
      tipo: tipoApp,
      mensaje: texto,
      media_url: mediaUrl,
      whatsapp_message_id: wamid,
      estado: "recibido",
      leido: false,
    },
    { onConflict: "whatsapp_message_id", ignoreDuplicates: true },
  )
  if (error) throw new Error(`No se pudo guardar el mensaje: ${error.message}`)
}

async function procesarEstado(db: SupabaseClient, st: any) {
  const wamid: string | undefined = st?.id
  const nuevo = ESTADO_META[st?.status as string]
  if (!wamid || !nuevo) return

  const { data: actual } = await db
    .from("whatsapp_mensajes")
    .select("id, estado")
    .eq("whatsapp_message_id", wamid)
    .maybeSingle()
  if (!actual) return
  if ((RANGO_ESTADO[actual.estado] ?? 0) >= RANGO_ESTADO[nuevo]) return

  await db.from("whatsapp_mensajes").update({ estado: nuevo }).eq("id", actual.id)
}

// POST: eventos entrantes de WhatsApp.
export async function POST(request: Request) {
  const config = configWhatsApp()
  if (!config.appSecret || !config.phoneNumberId) {
    // Sin secreto no se puede validar el origen: no se procesa nada.
    return new Response("WhatsApp no configurado.", { status: 503 })
  }

  const cuerpo = await request.text()
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), config.appSecret)) {
    return new Response("Firma inválida.", { status: 401 })
  }

  let payload: any
  try {
    payload = JSON.parse(cuerpo)
  } catch {
    return new Response("Cuerpo inválido.", { status: 400 })
  }
  if (payload?.object !== "whatsapp_business_account") {
    return Response.json({ ok: true, ignorado: true })
  }

  const db = servicio()
  if (!db) {
    console.error("[whatsapp] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY; evento no guardado.")
    return new Response("Base de datos no configurada.", { status: 503 })
  }

  try {
    for (const entry of payload?.entry ?? []) {
      for (const cambio of entry?.changes ?? []) {
        const value = cambio?.value ?? {}
        // Solo eventos de nuestro número.
        if (value?.metadata?.phone_number_id !== config.phoneNumberId) continue

        for (const msg of value?.messages ?? []) {
          await procesarMensaje(db, msg, value?.contacts ?? [])
        }
        for (const st of value?.statuses ?? []) {
          await procesarEstado(db, st)
        }
      }
    }
  } catch (error) {
    // 500 para que Meta reintente; los duplicados se descartan por whatsapp_message_id.
    console.error("[whatsapp] Error al procesar el webhook:", (error as Error).message)
    return new Response("Error al procesar.", { status: 500 })
  }

  return Response.json({ ok: true })
}

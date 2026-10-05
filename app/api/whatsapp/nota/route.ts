import { normalizarTelefonoEnvio } from "@/lib/whatsapp"
import { autorizarWhatsApp, validarContexto } from "@/lib/whatsapp-server"

// Nota interna en una conversación de WhatsApp: no se envía a Meta, solo queda
// en el hilo. Mismos roles que el envío (Administrador, Coordinador, Supervisor).

export const dynamic = "force-dynamic"

const MAX_LARGO_NOTA = 4096

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
  const nota: string = (body?.nota ?? "").toString().trim()
  const leadId: string | null = body?.leadId || null
  const clienteId: string | null = body?.clienteId || null

  if (!telefono) return Response.json({ error: "Teléfono inválido." }, { status: 400 })
  if (!nota) return Response.json({ error: "La nota es obligatoria." }, { status: 400 })
  if (nota.length > MAX_LARGO_NOTA) {
    return Response.json(
      { error: `La nota no puede pasar de ${MAX_LARGO_NOTA} caracteres.` },
      { status: 400 },
    )
  }

  const errorContexto = await validarContexto(supabase, leadId, clienteId)
  if (errorContexto) return errorContexto

  // Mismos valores en minúscula que escribe mensajeWhatsAppToDb para una nota.
  const { data: row, error } = await supabase
    .from("whatsapp_mensajes")
    .insert({
      lead_id: leadId,
      cliente_id: clienteId,
      telefono,
      direccion: "saliente",
      tipo: "nota",
      mensaje: nota,
      estado: "enviado",
      nota_interna: true,
      leido: true,
      enviado_por: userId,
    })
    .select("*")
    .single()

  if (error || !row) {
    return Response.json({ error: "No se pudo guardar la nota." }, { status: 500 })
  }
  return Response.json({ mensaje: row })
}

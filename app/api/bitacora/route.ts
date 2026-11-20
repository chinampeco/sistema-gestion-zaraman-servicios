import { NextResponse } from "next/server"

import { registrarAcceso } from "@/lib/bitacora"
import { createClient } from "@/lib/supabase/server"

// Eventos que el navegador informa sobre la propia sesión.
const PERMITIDOS = new Set(["Verificación en dos pasos", "Cierre de sesión"])

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const evento = typeof body?.evento === "string" ? body.evento : ""
  if (!PERMITIDOS.has(evento)) return NextResponse.json({ error: "Evento no válido." }, { status: 400 })

  await registrarAcceso(request.headers, {
    evento: evento as "Verificación en dos pasos" | "Cierre de sesión",
    exito: body?.exito !== false,
    usuarioId: user.id,
    email: user.email ?? "",
  })
  return NextResponse.json({ ok: true })
}

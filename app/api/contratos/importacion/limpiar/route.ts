import { NextResponse } from "next/server"

import { borrarLote, esUuid, requerirGestor } from "@/lib/importacion-servidor"

// Borra la carpeta temporal de un lote (al confirmar o al cancelar).
export async function POST(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })

  const body = await request.json().catch(() => null)
  if (!esUuid(body?.lote)) return NextResponse.json({ error: "Lote inválido." }, { status: 400 })

  await borrarLote(sesion.empresaId, body.lote)
  return NextResponse.json({ ok: true })
}

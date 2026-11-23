import { NextResponse } from "next/server"

import { firmaRepresentante } from "@/lib/firmas-representante"
import { createClient } from "@/lib/supabase/server"

// Datos de la empresa activa para imprimir el currículum (incluye la firma del
// representante, que solo vive en el servidor). RLS decide qué puede leer.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })
  const { data: empresaId } = await supabase.rpc("empresa_activa")
  if (!empresaId) return NextResponse.json({ error: "Selecciona una empresa." }, { status: 403 })
  const { data: e } = await supabase.from("empresas").select("*").eq("id", empresaId).maybeSingle()
  if (!e) return NextResponse.json({ error: "Sin acceso a la empresa." }, { status: 403 })
  return NextResponse.json({
    empresa: {
      clave: e.clave ?? "",
      nombreComercial: e.nombre_comercial ?? "",
      razonSocial: e.razon_social ?? "",
      rfc: e.rfc ?? "",
      domicilio: e.domicilio ?? "",
      telefono: e.telefono ?? "",
      email: e.email ?? "",
      representanteLegal: e.representante_legal ?? "",
      representanteCargo: e.representante_cargo ?? "",
      giro: e.giro ?? "",
      firma: firmaRepresentante(e.clave ?? ""),
    },
  })
}

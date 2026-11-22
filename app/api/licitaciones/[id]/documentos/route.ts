import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES, nombreArchivoSeguro } from "@/lib/contratos"
import { adminClient, esUuid, requerirGestor } from "@/lib/importacion-servidor"
import { carpetaLicitacion } from "@/lib/licitaciones"
import { createClient } from "@/lib/supabase/server"

// Tipos que acepta el bucket "expedientes".
const TIPOS_PERMITIDOS = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
])
const MAX_BYTES = 25 * 1024 * 1024
const MAX_ARCHIVOS = 15

// Reserva rutas en la carpeta de la licitación y devuelve URLs de subida firmadas.
// El navegador sube directo al almacenamiento y luego registra cada documento.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })

  // La licitación debe existir en la empresa activa (lo decide RLS con la sesión del usuario).
  const supabase = await createClient()
  const { data: lic } = await supabase.from("licitaciones").select("id, empresa_id").eq("id", id).maybeSingle()
  if (!lic || lic.empresa_id !== sesion.empresaId) {
    return NextResponse.json({ error: "La licitación no existe en esta empresa." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const archivos: unknown = body?.archivos
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un archivo." }, { status: 400 })
  }
  if (archivos.length > MAX_ARCHIVOS) {
    return NextResponse.json({ error: `Máximo ${MAX_ARCHIVOS} archivos a la vez.` }, { status: 400 })
  }

  const admin = adminClient()
  const carpeta = carpetaLicitacion(sesion.empresaId, id)
  const subidas = []
  for (const [i, a] of archivos.entries()) {
    const nombre = typeof a?.nombre === "string" ? a.nombre.slice(0, 200) : ""
    const tipo = typeof a?.tipo === "string" ? a.tipo : ""
    const tamano = typeof a?.tamano === "number" ? a.tamano : -1
    if (!nombre || !TIPOS_PERMITIDOS.has(tipo)) {
      return NextResponse.json({ error: `“${nombre || "archivo"}”: usa PDF, Word, Excel o imagen.` }, { status: 400 })
    }
    if (tamano <= 0 || tamano > MAX_BYTES) {
      return NextResponse.json({ error: `“${nombre}” pesa más de 25 MB.` }, { status: 400 })
    }
    const ruta = `${carpeta}/${Date.now()}-${i}-${nombreArchivoSeguro(nombre)}`
    const { data, error } = await admin.storage.from(BUCKET_EXPEDIENTES).createSignedUploadUrl(ruta)
    if (error || !data) return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 })
    subidas.push({ indice: i, ruta, token: data.token })
  }
  return NextResponse.json({ subidas })
}

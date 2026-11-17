import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { adminClient } from "@/lib/importacion-servidor"
import { accesoOrden } from "@/lib/orden-acceso"

// Descarga del escaneo firmado de una orden (órdenes subidas como historial).
// Lo pueden descargar el personal, el técnico asignado y el cliente dueño.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await accesoOrden((await params).id)
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status })

  const admin = adminClient()
  const { data: orden } = await admin
    .from("ordenes_servicio")
    .select("folio, documento_firmado_id")
    .eq("id", acceso.ordenId)
    .single()
  if (!orden?.documento_firmado_id) {
    return NextResponse.json({ error: "Esta orden no tiene escaneo firmado." }, { status: 404 })
  }
  const { data: doc } = await admin
    .from("contrato_documentos")
    .select("storage_path, nombre_archivo")
    .eq("id", orden.documento_firmado_id)
    .single()
  if (!doc) return NextResponse.json({ error: "No se encontró el archivo." }, { status: 404 })

  const { data: firmada, error } = await admin.storage
    .from(BUCKET_EXPEDIENTES)
    .createSignedUrl(doc.storage_path, 300, { download: `${orden.folio} - ${doc.nombre_archivo}` })
  if (error || !firmada) return NextResponse.json({ error: "No se pudo preparar la descarga." }, { status: 500 })
  return NextResponse.json({ url: firmada.signedUrl })
}

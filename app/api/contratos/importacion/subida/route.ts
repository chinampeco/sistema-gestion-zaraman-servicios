import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES, nombreArchivoSeguro } from "@/lib/contratos"
import {
  MAX_ARCHIVOS_IMPORTACION,
  MAX_BYTES_IMPORTACION,
  MAX_BYTES_TOTAL_IMPORTACION,
  TIPOS_LECTURA,
} from "@/lib/importacion-contratos"
import { MAX_ARCHIVOS_ORDENES, MAX_BYTES_TOTAL_ORDENES } from "@/lib/importacion-ordenes"
import { adminClient, carpetaLote, requerirGestor } from "@/lib/importacion-servidor"

// Paso 1: el servidor reserva rutas en la carpeta temporal y devuelve URLs de
// subida firmadas. El navegador sube los archivos directo al almacenamiento
// (así no pasan por la función, que tiene límite de tamaño).
export async function POST(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })

  const body = await request.json().catch(() => null)
  const archivos: unknown = body?.archivos
  // "ordenes": órdenes físicas firmadas (más archivos, cada uno se lee por separado).
  const ordenes = body?.modo === "ordenes"
  const maxArchivos = ordenes ? MAX_ARCHIVOS_ORDENES : MAX_ARCHIVOS_IMPORTACION
  const maxTotal = ordenes ? MAX_BYTES_TOTAL_ORDENES : MAX_BYTES_TOTAL_IMPORTACION
  if (!Array.isArray(archivos) || archivos.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un archivo." }, { status: 400 })
  }
  if (archivos.length > maxArchivos) {
    return NextResponse.json(
      { error: `Máximo ${maxArchivos} archivos ${ordenes ? "por lote" : "por contrato"}.` },
      { status: 400 },
    )
  }

  let total = 0
  const lista: { nombre: string; tipo: string; tamano: number }[] = []
  for (const a of archivos) {
    const nombre = typeof a?.nombre === "string" ? a.nombre : ""
    const tipo = typeof a?.tipo === "string" ? a.tipo : ""
    const tamano = typeof a?.tamano === "number" ? a.tamano : -1
    if (!nombre || !(tipo in TIPOS_LECTURA)) {
      return NextResponse.json({ error: `“${nombre || "archivo"}”: usa PDF, Word (.docx) o imagen.` }, { status: 400 })
    }
    if (tamano <= 0 || tamano > MAX_BYTES_IMPORTACION) {
      return NextResponse.json({ error: `“${nombre}” pesa más de ${MAX_BYTES_IMPORTACION / 1024 / 1024} MB.` }, { status: 400 })
    }
    total += tamano
    lista.push({ nombre, tipo, tamano })
  }
  if (total > maxTotal) {
    return NextResponse.json(
      { error: `Los archivos suman más de ${maxTotal / 1024 / 1024} MB.` },
      { status: 400 },
    )
  }

  const lote = randomUUID()
  const carpeta = carpetaLote(sesion.empresaId, lote)
  const admin = adminClient()
  const subidas = []
  for (const [i, a] of lista.entries()) {
    const ruta = `${carpeta}/${i}-${nombreArchivoSeguro(a.nombre)}`
    const { data, error } = await admin.storage.from(BUCKET_EXPEDIENTES).createSignedUploadUrl(ruta)
    if (error || !data) {
      return NextResponse.json({ error: "No se pudo preparar la subida." }, { status: 500 })
    }
    subidas.push({ indice: i, ruta, token: data.token })
  }
  return NextResponse.json({ lote, subidas })
}

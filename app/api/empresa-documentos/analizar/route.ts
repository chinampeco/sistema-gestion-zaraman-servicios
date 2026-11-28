import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { INFO_TIPO, TIPOS_DOCUMENTO_EMPRESA } from "@/lib/empresa-documentos"
import { ESQUEMA_DOCUMENTO_EMPRESA, normalizarLecturaDocumento } from "@/lib/empresa-documentos-lectura"
import { bloquesDeArchivo, errorIA, extraerJson, MODELO_LECTURA } from "@/lib/importacion-ia"
import { adminClient, carpetaLote, esUuid, requerirGestor } from "@/lib/importacion-servidor"

export const maxDuration = 120

const INSTRUCCIONES = `Eres el auxiliar administrativo de una empresa mexicana que participa en licitaciones de gobierno (ComprasMX). Recibes UN documento corporativo de la empresa (opinión de cumplimiento del SAT, IMSS o INFONAVIT, constancia de situación fiscal, acta constitutiva, poder notarial, identificación del representante, comprobante de domicilio, constancia de e.firma, registro REPSE, estratificación MIPYME, estado de cuenta, etc.). Extrae sus datos para registrarlo con su vigencia. Un humano revisará antes de guardar: es mejor dejar un campo vacío que inventarlo.

Reglas
- tipo: el de esta lista que corresponda (usa "Otro" si ninguno aplica):
${TIPOS_DOCUMENTO_EMPRESA.map((t) => `  - ${t}: ${INFO_TIPO[t].ayuda}`).join("\n")}
- fecha_emision: fecha de emisión, expedición o generación del documento (AAAA-MM-DD). En opiniones de cumplimiento es la "fecha y hora de emisión"; en actas y poderes, la fecha de la escritura; en comprobantes de domicilio y estados de cuenta, la fecha de emisión o del periodo.
- vigente_hasta: SOLO si el documento dice expresamente hasta cuándo es válido (p. ej. vigencia de la credencial INE, vencimiento del certificado de e.firma, vigencia del registro REPSE). Si no lo dice, "".
- folio: folio, número de escritura, número de registro o de certificado, según el documento.
- sentido: "Positivo" o "Negativo" solo en opiniones de cumplimiento (SAT, IMSS, INFONAVIT) o constancias sin/con adeudo; en los demás, "".
- rfc y razon_social: los del contribuyente o empresa a la que pertenece el documento (no los de la autoridad que lo emite).
- descripcion: una frase corta para identificarlo (p. ej. "Opinión SAT positiva, folio 26NM1615110", "Escritura 8,742, Notaría 158").
- advertencias: frases cortas en español sobre lo ilegible, lo dudoso o lo que no cuadre.`

const FORMATO_RESPUESTA = `Formato de la respuesta
Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin bloques de código) que cumpla este JSON Schema:
${JSON.stringify(ESQUEMA_DOCUMENTO_EMPRESA)}`

export async function POST(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY)." }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const lote = body?.lote
  const nombre = typeof body?.nombre === "string" ? body.nombre.slice(0, 200) : "documento"
  if (!esUuid(lote)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })

  // Solo se lee de la carpeta temporal de este lote y de la empresa activa.
  const admin = adminClient()
  const carpeta = carpetaLote(sesion.empresaId, lote)
  const { data: listado } = await admin.storage.from(BUCKET_EXPEDIENTES).list(carpeta, { limit: 10 })
  const archivo = (listado ?? []).find((f) => f.name.startsWith("0-"))
  if (!archivo) return NextResponse.json({ error: "No se encontró el archivo subido." }, { status: 404 })
  const { data: blob, error } = await admin.storage.from(BUCKET_EXPEDIENTES).download(`${carpeta}/${archivo.name}`)
  if (error || !blob) return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 500 })
  const bloques = await bloquesDeArchivo(Buffer.from(await blob.arrayBuffer()), nombre)
  if (!bloques) return NextResponse.json({ error: "Este tipo de archivo no se puede leer." }, { status: 400 })

  const client = new Anthropic()
  try {
    const stream = client.beta.messages.stream({
      model: MODELO_LECTURA,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: `${INSTRUCCIONES}\n\n${FORMATO_RESPUESTA}`,
      messages: [
        { role: "user", content: [...bloques, { type: "text", text: "Extrae los datos de este documento y responde solo con el objeto JSON." }] },
      ],
    })
    const respuesta = await stream.finalMessage()
    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA no pudo leer este documento; captura las fechas a mano." }, { status: 422 })
    }
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: unknown
    try {
      crudo = JSON.parse(extraerJson(texto))
    } catch {
      return NextResponse.json({ error: "No se pudo interpretar la lectura; captura las fechas a mano." }, { status: 502 })
    }
    return NextResponse.json({ lectura: normalizarLecturaDocumento(crudo) })
  } catch (e) {
    console.error("[empresa-documentos/analizar]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    const { mensaje, status } = errorIA(e, "No se pudo leer el documento; captura las fechas a mano.")
    return NextResponse.json({ error: mensaje }, { status })
  }
}

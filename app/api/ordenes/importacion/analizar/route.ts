import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { bloquesDeArchivo, extraerJson, MODELO_LECTURA } from "@/lib/importacion-ia"
import { ESQUEMA_ORDENES, MAX_ARCHIVOS_ORDENES, normalizarLectura } from "@/lib/importacion-ordenes"
import { adminClient, carpetaLote, esUuid, requerirGestor } from "@/lib/importacion-servidor"

// Se analiza un archivo por llamada (unas cuantas hojas): basta con dos minutos.
export const maxDuration = 120

const INSTRUCCIONES = `Eres el capturista de una empresa mexicana de mantenimiento industrial que trabaja para dependencias de gobierno (SEDENA, ISSFAM, CFE, PEMEX, IMSS, etc.).

Recibes UN archivo con una o varias ÓRDENES DE SERVICIO físicas ya realizadas: hojas impresas, llenadas y firmadas a mano, escaneadas o fotografiadas. Cada empresa (Toltecatl, BOCAM, Zaraman) tiene su propio formato, pero todas traen datos parecidos. Extrae cada orden para cerrarla en el sistema. Un humano revisará todo antes de guardar: es mejor dejar un campo vacío y avisar que inventar un dato.

Reglas
- Una entrada en "ordenes" por cada orden distinta del archivo (normalmente una por hoja; si una orden ocupa varias hojas, es una sola).
- referencia: el número de la orden tal como está impreso (p. ej. "P01.SAE-245-01"). folio: un folio de sistema si aparece aparte (p. ej. "TOL-OS-000001", "BOC-OS-000012"); si no, "".
- fecha: la de la orden o la de entrega del trabajo, en AAAA-MM-DD. Las fechas escritas a mano suelen ir en formato día-mes-año (03-11-26 = 2026-11-03).
- numero_contrato y partida: el contrato y el número de partida que indique la hoja.
- equipos: cada equipo listado, con su número de serie y su número de inventario / S.I.L. / clave de la dependencia en "inventario". Si la tabla dice cantidad 5 con cinco números, son cinco equipos. Copia los números carácter por carácter, sin espacios.
- actividades: cada actividad o renglón de trabajo con su número; realizada = true si tiene palomita, marca o "sí" en la columna de realizado.
- tecnicos: nombres de quienes entregaron o realizaron el trabajo por parte de la empresa. verifico: quien verificó por parte de la empresa. recibio_area_tecnica y recibio_area_usuaria: nombres (con grado o cargo si lo tienen) de quienes recibieron por la dependencia. Los nombres están escritos a mano: escríbelos lo mejor posible y avisa en advertencias si no estás seguro.
- firmada: true si hay firma de recibido de la dependencia.
- observaciones: el texto escrito en observaciones o notas, si lo hay.

Advertencias
- Anota en "advertencias" (frases cortas en español) lo ilegible, lo dudoso y lo que falte (p. ej. "No se lee la fecha", "Nombre del área técnica poco legible").`

const FORMATO_RESPUESTA = `Formato de la respuesta
Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin bloques de código) que cumpla este JSON Schema:
${JSON.stringify(ESQUEMA_ORDENES)}`

export async function POST(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY) en Vercel." },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => null)
  const lote = body?.lote
  const indice = body?.indice
  const nombre = typeof body?.nombre === "string" ? body.nombre.slice(0, 200) : "archivo"
  if (!esUuid(lote) || !Number.isInteger(indice) || indice < 0 || indice >= MAX_ARCHIVOS_ORDENES) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  // Solo se lee de la carpeta temporal de este lote y de la empresa activa.
  const admin = adminClient()
  const carpeta = carpetaLote(sesion.empresaId, lote)
  const { data: listado } = await admin.storage.from(BUCKET_EXPEDIENTES).list(carpeta, { limit: 100 })
  const archivo = (listado ?? []).find((f) => f.name.startsWith(`${indice}-`))
  if (!archivo) return NextResponse.json({ error: "No se encontró el archivo subido." }, { status: 404 })

  const { data: blob, error } = await admin.storage.from(BUCKET_EXPEDIENTES).download(`${carpeta}/${archivo.name}`)
  if (error || !blob) return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 500 })
  const bloques = await bloquesDeArchivo(Buffer.from(await blob.arrayBuffer()), nombre)
  if (!bloques) return NextResponse.json({ error: `“${nombre}” no es PDF, Word ni imagen.` }, { status: 400 })

  const client = new Anthropic()
  try {
    const stream = client.beta.messages.stream({
      model: MODELO_LECTURA,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: `${INSTRUCCIONES}\n\n${FORMATO_RESPUESTA}`,
      messages: [
        {
          role: "user",
          content: [...bloques, { type: "text", text: "Extrae las órdenes de servicio de este archivo y responde solo con el objeto JSON." }],
        },
      ],
    })
    const respuesta = await stream.finalMessage()
    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA no pudo procesar este archivo." }, { status: 422 })
    }
    if (respuesta.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "El archivo trae demasiadas órdenes; divídelo en varios." }, { status: 422 })
    }
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: unknown
    try {
      crudo = JSON.parse(extraerJson(texto))
    } catch {
      return NextResponse.json({ error: "La respuesta de la IA no se pudo interpretar. Intenta de nuevo." }, { status: 502 })
    }
    return NextResponse.json({ lectura: normalizarLectura(crudo) })
  } catch (error) {
    console.error("[ordenes/importacion/analizar]", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error)
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "La clave de la IA no es válida. Revísala en Vercel." }, { status: 503 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "La IA está saturada en este momento. Intenta en un minuto." }, { status: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Error de la IA (${error.status ?? "sin estado"}). Intenta de nuevo.` }, { status: 502 })
    }
    return NextResponse.json({ error: "No se pudo analizar el archivo." }, { status: 500 })
  }
}

import Anthropic from "@anthropic-ai/sdk"
import mammoth from "mammoth"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import {
  ESQUEMA_EXTRACCION,
  MAX_ARCHIVOS_IMPORTACION,
  normalizarExtraccion,
} from "@/lib/importacion-contratos"
import { adminClient, carpetaLote, esUuid, requerirGestor } from "@/lib/importacion-servidor"

// Un contrato escaneado de ~20 páginas puede tardar un par de minutos.
export const maxDuration = 300

const MODELO = "claude-opus-5-5"

const INSTRUCCIONES = `Eres el analista de contratos de una empresa mexicana de servicios de mantenimiento industrial que trabaja para dependencias de gobierno (SEDENA, ISSFAM, CFE, PEMEX, IMSS, etc.) bajo la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público (LAASSP).

Recibes los documentos de UN contrato: el contrato firmado (a veces escaneado), sus anexos técnicos o fichas técnicas, y a veces la póliza de fianza o el formato de fianza de la dependencia. Extrae los datos para dar de alta el contrato en el sistema. Un humano revisará todo antes de guardar, así que es mejor dejar un campo vacío y avisar que inventar un dato.

Reglas generales
- Copia nombres, números y textos tal como aparecen (respeta acentos y mayúsculas del documento). No inventes datos: si algo no aparece, usa "" o null.
- Fechas en formato AAAA-MM-DD. Montos como número, sin comas ni signo de pesos.
- "dependencia" es el CLIENTE (la institución contratante, p. ej. "Secretaría de la Defensa Nacional"), no el proveedor. Su RFC suele estar en las declaraciones de la dependencia.
- subtotal = monto antes de IVA; iva = impuesto; total = con IVA.
- Porcentajes como número (10 = 10 %). Garantía de cumplimiento: porcentaje sobre el monto sin IVA. Garantía de calidad: vigencia en meses. Pena convencional: porcentaje diario y tope máximo.
- procedimiento: elige el valor de la lista que corresponda ("Invitación a cuando menos tres personas", "Licitación pública", "Adjudicación directa" u "Otro").

Partidas
- Una partida por cada partida del contrato o ficha técnica, con su número, descripción, unidad, cantidad, precio unitario sin IVA y CUCoP si viene.
- alcance: el texto del servicio requerido según la ficha técnica (qué se va a hacer), completo pero sin cláusulas legales.
- lugar_ejecucion: domicilio donde se presta el servicio.
- ficha_tecnica: número de ficha técnica si existe (p. ej. "12"); nombre_proyecto: nombre del proyecto o procedimiento al que pertenece.
- Ubicación jerárquica de la partida (texto, "" si no se puede saber):
  - region: región a la que pertenece la instalación (p. ej. "I Región Militar"). Solo si el documento la menciona o se deduce sin duda de él.
  - zona: zona (p. ej. "1/a. Zona Militar"), con el mismo criterio.
  - instalacion: unidad, dependencia o instalación donde está el equipo (p. ej. "Centro Militar de Ciencias de la Salud", "U.H.M. Mexicali IV").
  - area: área específica dentro de la instalación (p. ej. "Alberca olímpica", "PTAR").
  Si region o zona no vienen en los documentos, déjalas vacías y agrégalo a advertencias para que el usuario las capture.
- equipos: los equipos que cubre la partida. Si el documento da números de serie o de inventario (S.I.L. u otros) por cada unidad, devuelve UN renglón por unidad con cantidad 1 y su número; si no los da, un renglón por tipo de equipo con la cantidad total. Incluye marca y modelo si vienen.
- actividades: la lista de actividades o conceptos de trabajo de la ficha, numeradas en orden, con sus incisos en "detalle". Si la ficha solo trae un párrafo, una actividad con ese texto.

Garantías
- Una entrada por cada garantía que exige el contrato (cumplimiento, calidad, anticipo...). Indica forma (póliza de fianza si no se especifica otra), porcentaje, monto (porcentaje × subtotal si no viene), si es divisible, beneficiaria (normalmente "Tesorería de la Federación") y fecha_limite_entrega si el contrato da un plazo (p. ej. 10 días naturales después de la firma).
- Si entre los archivos hay una póliza EMITIDA por una afianzadora, completa esa garantía con afianzadora, numero_poliza, folio, linea_validacion, fecha_expedicion y vigencia_hasta (si la tiene), y pon en archivo_poliza el índice de ese archivo. Un formato en blanco de la dependencia no es póliza emitida.
- requerida = false solo si el contrato exceptúa expresamente esa garantía.

Documentos
- Clasifica cada archivo por su índice (0, 1, 2… en el orden en que se entregan) con el tipo de la lista y una descripción corta.

Advertencias
- Anota en "advertencias" (en español, frases cortas) lo que no se pudo leer, lo que no cuadra (p. ej. la suma de partidas no coincide con el subtotal, fechas incongruentes) y los datos que el usuario debe completar a mano.`

type Bloque = Anthropic.Beta.BetaContentBlockParam

function tipoPorFirma(bytes: Uint8Array): "pdf" | "docx" | "jpeg" | "png" | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx"
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  return null
}

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
  const nombres: unknown = body?.nombres
  if (!esUuid(lote) || !Array.isArray(nombres) || nombres.length === 0 || nombres.length > MAX_ARCHIVOS_IMPORTACION) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  // Solo se leen archivos de la carpeta temporal de este lote y de la empresa activa.
  const admin = adminClient()
  const carpeta = carpetaLote(sesion.empresaId, lote)
  const { data: listado } = await admin.storage.from(BUCKET_EXPEDIENTES).list(carpeta, { limit: 100 })
  const archivos = (listado ?? [])
    .map((f) => ({ nombre: f.name, indice: Number.parseInt(f.name.split("-")[0] ?? "", 10) }))
    .filter((f) => Number.isInteger(f.indice) && f.indice >= 0 && f.indice < nombres.length)
    .sort((a, b) => a.indice - b.indice)
  if (archivos.length !== nombres.length) {
    return NextResponse.json({ error: "No se encontraron todos los archivos subidos. Vuelve a intentarlo." }, { status: 400 })
  }

  const contenido: Bloque[] = []
  for (const f of archivos) {
    const { data: blob, error } = await admin.storage.from(BUCKET_EXPEDIENTES).download(`${carpeta}/${f.nombre}`)
    if (error || !blob) {
      return NextResponse.json({ error: "No se pudo leer uno de los archivos." }, { status: 500 })
    }
    const buffer = Buffer.from(await blob.arrayBuffer())
    const titulo = `Archivo ${f.indice}: ${String(nombres[f.indice]).slice(0, 200)}`
    const tipo = tipoPorFirma(buffer)
    if (tipo === "pdf") {
      contenido.push({
        type: "document",
        title: titulo,
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      })
    } else if (tipo === "docx") {
      // Word no se envía tal cual: se convierte a HTML (conserva las tablas) sin imágenes.
      const { value: html } = await mammoth.convertToHtml(
        { buffer },
        { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
      )
      contenido.push({
        type: "document",
        title: titulo,
        source: { type: "text", media_type: "text/plain", data: html || "(documento vacío)" },
      })
    } else if (tipo === "jpeg" || tipo === "png") {
      contenido.push({ type: "text", text: titulo })
      contenido.push({
        type: "image",
        source: { type: "base64", media_type: tipo === "png" ? "image/png" : "image/jpeg", data: buffer.toString("base64") },
      })
    } else {
      return NextResponse.json({ error: `“${String(nombres[f.indice])}” no es PDF, Word ni imagen.` }, { status: 400 })
    }
  }
  contenido.push({
    type: "text",
    text: `Son ${archivos.length} archivo(s), índices 0 a ${archivos.length - 1}. Extrae los datos del contrato según las instrucciones.`,
  })

  const client = new Anthropic()
  try {
    const stream = client.beta.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      // Si un clasificador de seguridad rechaza la petición, la API la reintenta
      // con el modelo de respaldo recomendado.
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: ESQUEMA_EXTRACCION },
      },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: contenido }],
    })
    const respuesta = await stream.finalMessage()

    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA no pudo procesar estos documentos. Captura el contrato a mano." }, { status: 422 })
    }
    if (respuesta.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "Los documentos son demasiado extensos para leerlos de una vez. Sube menos archivos." }, { status: 422 })
    }
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: unknown
    try {
      crudo = JSON.parse(texto)
    } catch {
      return NextResponse.json({ error: "La respuesta de la IA no se pudo interpretar. Intenta de nuevo." }, { status: 502 })
    }
    return NextResponse.json({ extraccion: normalizarExtraccion(crudo, archivos.length), modelo: respuesta.model })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "La clave de la IA no es válida. Revísala en Vercel." }, { status: 503 })
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "La IA está saturada en este momento. Intenta en un minuto." }, { status: 429 })
    }
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json({ error: `La IA rechazó los archivos: ${error.message}` }, { status: 400 })
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `Error de la IA (${error.status ?? "sin estado"}). Intenta de nuevo.` }, { status: 502 })
    }
    return NextResponse.json({ error: "No se pudo analizar los documentos." }, { status: 500 })
  }
}

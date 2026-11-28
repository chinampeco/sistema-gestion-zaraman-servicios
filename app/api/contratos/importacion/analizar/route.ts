import Anthropic from "@anthropic-ai/sdk"
import { after, NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import {
  ESQUEMA_EXTRACCION,
  MAX_ARCHIVOS_IMPORTACION,
  normalizarExtraccion,
} from "@/lib/importacion-contratos"
import { bloquesDeArchivo, errorIA, extraerJson, MODELO_LECTURA, type Bloque } from "@/lib/importacion-ia"
import {
  adminClient,
  carpetaLote,
  esUuid,
  guardarEstadoLote,
  leerEstadoLote,
  requerirGestor,
} from "@/lib/importacion-servidor"

// Un contrato escaneado de ~20 páginas puede tardar un par de minutos.
export const maxDuration = 300

const MODELO = MODELO_LECTURA

const INSTRUCCIONES = `Eres el analista de contratos de una empresa mexicana de servicios de mantenimiento industrial que trabaja para dependencias de gobierno (SEDENA, ISSFAM, CFE, PEMEX, IMSS, etc.) bajo la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público (LAASSP).

Recibes los documentos de UN contrato: el contrato firmado (a veces escaneado), sus anexos técnicos o fichas técnicas, y a veces la póliza de fianza o el formato de fianza de la dependencia. Extrae los datos para dar de alta el contrato en el sistema. Un humano revisará todo antes de guardar, así que es mejor dejar un campo vacío y avisar que inventar un dato.

Reglas generales
- Copia nombres, números y textos tal como aparecen (respeta acentos y mayúsculas del documento). No inventes datos: si algo no aparece, usa "" o null.
- Fechas en formato AAAA-MM-DD. Montos como número, sin comas ni signo de pesos.
- "dependencia" es el CLIENTE (la institución contratante, p. ej. "Secretaría de la Defensa Nacional"), no el proveedor. Su RFC suele estar en las declaraciones de la dependencia.
- dependencia.area_usuaria: el ÁREA USUARIA del contrato, es decir, la unidad que recibe el servicio y firma de conformidad (p. ej. "Centro Militar de Ciencias de la Salud", "Hospital Central Militar"). En el sistema ella queda como el cliente. Búscala como "área usuaria", "área requirente y usuaria", "unidad usuaria" o "lugar de prestación del servicio". Si el contrato no la nombra, usa el área requirente. area_usuaria_domicilio: su domicilio, si aparece.
- contacto_email y contacto_telefono: los del administrador o responsable del área usuaria, si vienen.
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

// Formato de la respuesta: el JSON Schema de la extracción, como texto.
const FORMATO_RESPUESTA = `Formato de la respuesta
Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin bloques de código) que cumpla este JSON Schema. Usa exactamente estos nombres de campo y, en los campos con "enum", solo esos valores:
${JSON.stringify(ESQUEMA_EXTRACCION)}`


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
    const bloques = await bloquesDeArchivo(buffer, titulo)
    if (!bloques) {
      return NextResponse.json({ error: `“${String(nombres[f.indice])}” no es PDF, Word ni imagen.` }, { status: 400 })
    }
    contenido.push(...bloques)
  }
  contenido.push({
    type: "text",
    text: `Son ${archivos.length} archivo(s), índices 0 a ${archivos.length - 1}. Extrae los datos del contrato según las instrucciones y responde solo con el objeto JSON.`,
  })

  // La lectura corre en segundo plano (after) y deja su resultado junto a los
  // archivos del lote; el navegador lo consulta con GET hasta que termine. Así un
  // contrato largo no se corta por el límite de tiempo de la respuesta.
  const inicio = new Date().toISOString()
  const { empresaId } = sesion
  await guardarEstadoLote(empresaId, lote, { estado: "leyendo", inicio })

  after(async () => {
    const fin = () => new Date().toISOString()
    const fallo = (error: string) => guardarEstadoLote(empresaId, lote, { estado: "error", inicio, fin: fin(), error })
    try {
      const stream = new Anthropic().beta.messages.stream({
        model: MODELO,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        // Si un clasificador de seguridad rechaza la petición, la API la reintenta
        // con el modelo de respaldo recomendado.
        fallbacks: "default",
        // El esquema completo es demasiado grande para la salida estricta de la API
        // ("compiled grammar is too large"): se pide como instrucción y la
        // respuesta se valida y normaliza en normalizarExtraccion().
        output_config: { effort: "medium" },
        system: `${INSTRUCCIONES}\n\n${FORMATO_RESPUESTA}`,
        messages: [{ role: "user", content: contenido }],
      })
      const respuesta = await stream.finalMessage()
      if (respuesta.stop_reason === "refusal") return void (await fallo("La IA no pudo procesar estos documentos. Captura el contrato a mano."))
      if (respuesta.stop_reason === "max_tokens") {
        return void (await fallo("Los documentos son demasiado extensos para leerlos de una vez. Sube menos archivos."))
      }
      const texto = respuesta.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
      let crudo: unknown
      try {
        crudo = JSON.parse(extraerJson(texto))
      } catch {
        return void (await fallo("La respuesta de la IA no se pudo interpretar. Intenta de nuevo."))
      }
      await guardarEstadoLote(empresaId, lote, {
        estado: "lista",
        inicio,
        fin: fin(),
        extraccion: normalizarExtraccion(crudo, archivos.length),
        modelo: respuesta.model,
      })
    } catch (error) {
      console.error("[importacion/analizar]", error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error)
      await fallo(errorIA(error, "No se pudieron analizar los documentos.").mensaje)
    }
  })

  return NextResponse.json({ estado: "leyendo", inicio }, { status: 202 })
}

// Estado de la lectura de un lote: leyendo | lista (con la extracción) | error.
export async function GET(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const lote = new URL(request.url).searchParams.get("lote")
  if (!esUuid(lote)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  const estado = await leerEstadoLote(sesion.empresaId, lote)
  if (!estado) return NextResponse.json({ error: "No hay una lectura en curso para estos archivos." }, { status: 404 })
  return NextResponse.json(estado, { headers: { "Cache-Control": "no-store" } })
}

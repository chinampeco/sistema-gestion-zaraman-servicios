import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { bloquesDeArchivo, extraerJson, MODELO_LECTURA } from "@/lib/importacion-ia"
import { adminClient, esUuid, requerirGestor } from "@/lib/importacion-servidor"
import { ESQUEMA_LECTURA_LICITACION, normalizarLecturaLicitacion } from "@/lib/licitaciones-lectura"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

// Límite de la petición a la IA (~32 MB): el PDF viaja en base64 (+33 %).
const MAX_BYTES_LECTURA = 22 * 1024 * 1024

const INSTRUCCIONES = `Eres el especialista en licitaciones públicas de una empresa mexicana de mantenimiento industrial que participa en procedimientos de gobierno (LAASSP, ComprasMX). Recibes UN documento de un procedimiento de contratación y lo conviertes en datos para que la empresa no pierda puntos ni sea desechada. Un humano revisará antes de aplicar: es mejor dejar un campo vacío que inventarlo. Todo en español.

Qué hacer según el documento (tipo_documento):

1. Convocatoria, anexos (técnico, administrativo, de evaluación) o junta de aclaraciones:
- datos: número del procedimiento (p. ej. LA-07-110-007000999-N-702-2026), número de expediente (E-2026-…), dependencia, unidad compradora/área contratante, objeto, tipo de procedimiento, carácter (Nacional/Internacional, Electrónica/Presencial/Mixta), criterio de evaluación ("Puntos y porcentajes", "Binario", "Costo beneficio") y puntos técnicos/económicos máximos (p. ej. 60 y 40).
- eventos: TODAS las fechas del calendario (publicación, junta de aclaraciones, presentación y apertura, fallo, firma del contrato) con hora si aparece. Agrega también las fechas que se derivan de reglas, calculándolas: "Límite de preguntas" (normalmente 24 h antes de la junta), fecha límite para coordinar o realizar visitas de campo, "Entrega de documentos" del adjudicado (p. ej. 96 h después del fallo), "Garantía de cumplimiento" (p. ej. 10 días naturales después de la firma), "Entrega del servicio" (fecha límite de entrega). En notas explica la regla usada.
- partidas: número, descripción corta y ubicación (lugar donde se presta el servicio).
- tabla_puntos: si hay criterio de puntos y porcentajes, CADA rubro/subrubro con su clave (p. ej. RI-SA-a), descripción, puntos máximos, cómo acreditarlo (qué documento exacto pide) y los niveles (condición → puntos).
- requisitos: lista de cumplimiento COMPLETA y concreta, un elemento por documento o acción:
  · Legal y administrativo: cada formato (Formato 1, 2, 3…), escrito bajo protesta, acta constitutiva, poderes, identificación, constancia de situación fiscal, manifiesto de interés, carta de confidencialidad, MIPYME, etc.
  · Técnico: propuesta técnica (formato y requisitos de forma: membrete, firma en todas las hojas, foliado consecutivo, PDF a color + Word editable, sin leyendas prohibidas), fichas técnicas, normas, visitas de campo con evidencia firmada por el área usuaria, etc.
  · Económico: propuesta económica y sus reglas (precio unitario sin IVA en ComprasMX, IVA desglosado, truncado a 2 decimales, que los nombres de las partidas coincidan EXACTAMENTE con la propuesta técnica…).
  · Puntos: un requisito por cada subrubro de la tabla de puntos, con puntos_max, y en descripcion qué entregar para obtener el máximo.
  · Formalización: lo que se entrega si se gana (opiniones SAT/IMSS/INFONAVIT positivas con antigüedad máxima, originales para cotejo, fianza, carta de garantía de calidad, firma electrónica del contrato…).
  numeral = el numeral de la convocatoria; formato = "Formato 7" o "Anexo B" si aplica; desecha = true si su falta o error es causal de desechamiento; obligatorio = false solo si es opcional (p. ej. puntos de 0.1 que se pueden no presentar).
- analisis.resumen: 3 a 5 frases con lo esencial (qué se contrata, cuántas partidas, plazos y lo más delicado).
- analisis.recomendaciones: acciones concretas para obtener la MÁXIMA puntuación y ganar (documentos exactos para cada subrubro, cómo presentar el precio, qué partidas convienen por plazo/ubicación, visitas de campo, foliado, revisión cruzada técnica vs. económica). Recuerda que en puntos y porcentajes gana quien suma más: técnico al máximo Y el precio más bajo (el precio más bajo se lleva todos los puntos económicos).
- analisis.causales_desechamiento: cada causal, en una frase clara.
- analisis.riesgos: lo que puede salir mal (plazos cortos, penas, garantías, fechas de entrega, documentos que vencen, partidas lejanas…).
- analisis.cambios_junta: solo en junta de aclaraciones, cada respuesta que cambie o precise la convocatoria.

2. Acta de fallo (o evaluación técnica/económica):
- resultado.nuestras: para cada partida en la que participó NUESTRA EMPRESA (te digo cuál abajo): resultado (Ganada/Perdida/Desechada), nuestros puntos técnicos, económicos y total, nuestro precio (subtotal sin IVA), quién ganó, su precio y su total, y el motivo (p. ej. "Propuesta desechada por el numeral 7.4.7: nombre de servicios distinto entre propuesta técnica y económica", o "Precio 31 % mayor que el ganador").
- resultado.ganadores: empresas adjudicadas, sus partidas y montos.
- resultado.puntos_perdidos: cada subrubro de la tabla de puntos donde NUESTRA EMPRESA no obtuvo el máximo: clave, obtenidos, máximo y la observación del evaluador.
- resultado.lecciones: qué hacer distinto la próxima vez, concreto y accionable.
- resultado.resumen: 2 a 4 frases.
- monto_adjudicado: lo que ganó NUESTRA EMPRESA con IVA (null si no ganó).
- Si además aparecen otras empresas del mismo grupo (te digo cuáles abajo) compitiendo en las MISMAS partidas que la nuestra, menciónalo en analisis.riesgos (posible colusión, numeral de integridad).

3. Otros documentos (propuesta, acuse ComprasMX, evidencia de visita, contrato): llena lo que aplique; en advertencias anota lo que falte o no cuadre con los requisitos (p. ej. hojas sin folio o sin firma, nombres que no coinciden, archivos que el acuse no lista).

En listas que no apliquen al documento, responde []. Usa null en números desconocidos. advertencias: frases cortas sobre lo ilegible o dudoso.`

const FORMATO_RESPUESTA = `Formato de la respuesta
Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin bloques de código) que cumpla este JSON Schema:
${JSON.stringify(ESQUEMA_LECTURA_LICITACION)}`

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY)." }, { status: 503 })
  }
  const { id } = await params
  const body = await request.json().catch(() => null)
  const documentoId = body?.documentoId
  if (!esUuid(id) || !esUuid(documentoId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })

  // Licitación y documento con la sesión del usuario: RLS confirma la empresa activa.
  const supabase = await createClient()
  const [{ data: lic }, { data: doc }] = await Promise.all([
    supabase.from("licitaciones").select("id, numero, objeto, partidas").eq("id", id).maybeSingle(),
    supabase
      .from("licitacion_documentos")
      .select("id, licitacion_id, tipo, nombre_archivo, storage_path, tamano_bytes")
      .eq("id", documentoId)
      .maybeSingle(),
  ])
  if (!lic || !doc || doc.licitacion_id !== id) {
    return NextResponse.json({ error: "El documento no existe en esta licitación." }, { status: 404 })
  }
  if (Number(doc.tamano_bytes) > MAX_BYTES_LECTURA) {
    return NextResponse.json({ error: "El archivo pesa más de 22 MB; la IA no puede leerlo completo. Divídelo en partes." }, { status: 400 })
  }

  const admin = adminClient()
  const [{ data: blob, error }, { data: empresas }] = await Promise.all([
    admin.storage.from(BUCKET_EXPEDIENTES).download(doc.storage_path),
    admin.from("empresas").select("id, razon_social, nombre_comercial, rfc").eq("activa", true),
  ])
  if (error || !blob) return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 500 })
  const bloques = await bloquesDeArchivo(Buffer.from(await blob.arrayBuffer()), doc.nombre_archivo)
  if (!bloques) return NextResponse.json({ error: "Este tipo de archivo no se puede leer (usa PDF, Word o imagen)." }, { status: 400 })

  const nuestra = (empresas ?? []).find((e) => e.id === sesion.empresaId)
  const grupo = (empresas ?? []).filter((e) => e.id !== sesion.empresaId)
  const contexto = [
    `NUESTRA EMPRESA: ${nuestra?.razon_social || nuestra?.nombre_comercial || "(sin nombre)"} (RFC ${nuestra?.rfc || "—"}).`,
    grupo.length
      ? `Otras empresas del mismo grupo: ${grupo.map((e) => `${e.razon_social || e.nombre_comercial} (RFC ${e.rfc || "—"})`).join("; ")}.`
      : "",
    lic.numero ? `Procedimiento ya registrado: ${lic.numero}. ${lic.objeto ?? ""}` : "",
    `El usuario lo subió como: ${doc.tipo}.`,
    `Fecha de hoy: ${new Date().toISOString().slice(0, 10)}.`,
  ]
    .filter(Boolean)
    .join("\n")

  const client = new Anthropic()
  try {
    const stream = client.beta.messages.stream({
      model: MODELO_LECTURA,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: `${INSTRUCCIONES}\n\n${FORMATO_RESPUESTA}`,
      messages: [
        {
          role: "user",
          content: [...bloques, { type: "text", text: `${contexto}\n\nLee el documento y responde solo con el objeto JSON.` }],
        },
      ],
    })
    const respuesta = await stream.finalMessage()
    if (respuesta.stop_reason === "refusal") {
      return NextResponse.json({ error: "La IA no pudo leer este documento." }, { status: 422 })
    }
    if (respuesta.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "El documento es demasiado extenso para leerlo de una vez; divídelo en partes." }, { status: 422 })
    }
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: unknown
    try {
      crudo = JSON.parse(extraerJson(texto))
    } catch {
      return NextResponse.json({ error: "No se pudo interpretar la lectura; intenta de nuevo." }, { status: 502 })
    }
    await supabase.from("licitacion_documentos").update({ analizado_at: new Date().toISOString() }).eq("id", doc.id)
    return NextResponse.json({ lectura: normalizarLecturaLicitacion(crudo) })
  } catch (e) {
    console.error("[licitaciones/analizar]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    if (e instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "La IA está saturada; intenta en un minuto." }, { status: 429 })
    }
    return NextResponse.json({ error: "No se pudo leer el documento; intenta de nuevo." }, { status: 502 })
  }
}

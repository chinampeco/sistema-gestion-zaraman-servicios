import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { mes, normalizarExperiencia } from "@/lib/curriculum"
import { bloquesDeArchivo, errorIA, extraerJson, MODELO_LECTURA } from "@/lib/importacion-ia"
import { adminClient, esUuid, requerirGestor } from "@/lib/importacion-servidor"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 300

const S = { type: "string" } as const
const ESQUEMA = {
  type: "object",
  properties: {
    semblanza: S,
    especialidades: { type: "array", items: S },
    infraestructura: S,
    certificaciones: { type: "array", items: S },
    experiencia: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cliente: S,
          numero: S,
          objeto: S,
          inicio: { type: "string", description: "AAAA-MM o AAAA" },
          fin: { type: "string", description: "AAAA-MM o AAAA, \"\" si sigue vigente o no se sabe" },
          monto: { type: ["number", "null"] },
          evidencia: S,
        },
        required: ["cliente", "numero", "objeto", "inicio", "fin", "monto", "evidencia"],
      },
    },
    advertencias: { type: "array", items: S },
  },
  required: ["semblanza", "especialidades", "infraestructura", "certificaciones", "experiencia", "advertencias"],
} as const

const INSTRUCCIONES = `Eres el auxiliar de licitaciones de una empresa mexicana de mantenimiento industrial. Recibes su currículum empresarial (el que presenta en ComprasMX y licitaciones). Extrae su contenido para reutilizarlo. Un humano revisará antes de guardar: no inventes datos.

- semblanza: presentación de la empresa en 1 o 2 párrafos (quién es, desde cuándo, a qué se dedica, a quién atiende), redactada en tercera persona y lista para el currículum.
- especialidades: servicios y tipos de equipo que atiende (p. ej. "Plantas de tratamiento de aguas residuales", "Calderas generadoras de vapor", "Subestaciones eléctricas"), frases cortas.
- infraestructura: instalaciones, herramientas, equipos de medición, vehículos y personal, en un párrafo.
- certificaciones: registros y certificaciones (REPSE, ISO, NOM, DC-3, MIPYME…), una por elemento.
- experiencia: CADA contrato o trabajo que liste (cliente/dependencia, número de contrato si aparece, objeto breve, periodo, monto con IVA si aparece y evidencia de cumplimiento mencionada como acta de aceptación o liberación de fianza; "" si no la menciona).
- advertencias: datos ilegibles, contradictorios o que convenga completar.

Responde ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después) que cumpla este JSON Schema:
${JSON.stringify(ESQUEMA)}`

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const lista = (v: unknown) => (Array.isArray(v) ? v.map(txt).filter(Boolean) : [])

export async function POST(request: Request) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY)." }, { status: 503 })
  }
  const body = await request.json().catch(() => null)
  const documentoId = body?.documentoId
  if (!esUuid(documentoId)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })

  // RLS: solo documentos de la empresa activa.
  const supabase = await createClient()
  const { data: doc } = await supabase
    .from("empresa_documentos")
    .select("id, nombre_archivo, storage_path, tamano_bytes")
    .eq("id", documentoId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: "El documento no existe en esta empresa." }, { status: 404 })
  if (Number(doc.tamano_bytes) > 22 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo pesa más de 22 MB; la IA no puede leerlo completo." }, { status: 400 })
  }

  const { data: blob, error } = await adminClient().storage.from(BUCKET_EXPEDIENTES).download(doc.storage_path)
  if (error || !blob) return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 500 })
  const bloques = await bloquesDeArchivo(Buffer.from(await blob.arrayBuffer()), doc.nombre_archivo)
  if (!bloques) return NextResponse.json({ error: "Este tipo de archivo no se puede leer (usa PDF, Word o imagen)." }, { status: 400 })

  try {
    const respuesta = await new Anthropic().beta.messages
      .stream({
        model: MODELO_LECTURA,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: INSTRUCCIONES,
        messages: [{ role: "user", content: [...bloques, { type: "text", text: "Extrae el currículum y responde solo con el objeto JSON." }] }],
      })
      .finalMessage()
    if (respuesta.stop_reason === "refusal") return NextResponse.json({ error: "La IA no pudo leer este documento." }, { status: 422 })
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: any
    try {
      crudo = JSON.parse(extraerJson(texto))
    } catch {
      return NextResponse.json({ error: "No se pudo interpretar la lectura; intenta de nuevo." }, { status: 502 })
    }
    return NextResponse.json({
      lectura: {
        semblanza: txt(crudo?.semblanza),
        especialidades: lista(crudo?.especialidades),
        infraestructura: txt(crudo?.infraestructura),
        certificaciones: lista(crudo?.certificaciones),
        experiencia: normalizarExperiencia(
          (Array.isArray(crudo?.experiencia) ? crudo.experiencia : []).map((e: any) => ({ ...e, inicio: mes(e?.inicio), fin: mes(e?.fin) })),
        ),
        advertencias: lista(crudo?.advertencias),
      },
    })
  } catch (e) {
    console.error("[empresa-curriculum/analizar]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    const { mensaje, status } = errorIA(e)
    return NextResponse.json({ error: mensaje }, { status })
  }
}

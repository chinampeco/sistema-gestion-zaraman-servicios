import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { bloquesDeArchivo, extraerJson, MODELO_LECTURA, type Bloque } from "@/lib/importacion-ia"
import { adminClient, esUuid, requerirGestor } from "@/lib/importacion-servidor"
import { createClient } from "@/lib/supabase/server"
import { normalizarPerfil } from "@/lib/tecnico-perfil"

export const maxDuration = 180

// Tipos de documento que se leen para armar el perfil, en orden de importancia.
const PRIORIDAD = ["Currículum", "Cédula profesional", "Título / certificado de estudios", "Constancia DC-3", "Certificación / curso"]
const MAX_DOCUMENTOS = 6
const MAX_BYTES = 15 * 1024 * 1024

const INSTRUCCIONES = `Eres el reclutador técnico de una empresa mexicana de mantenimiento industrial (aire acondicionado y refrigeración, redes eléctricas de baja y media tensión, plantas de emergencia, bombas, PTAR, equipo médico, etc.) que da servicio a dependencias de gobierno.

Recibes el expediente de UN técnico (currículum, cédula, títulos, constancias DC-3, certificaciones) y sus datos de registro. Arma su perfil para decidir a qué servicios conviene asignarlo. No inventes: usa solo lo que dicen los documentos y los datos de registro.

Responde ÚNICAMENTE con un objeto JSON (sin texto antes ni después) con esta forma:
{
  "especialidades": ["…"],      // áreas de trabajo en minúsculas y cortas: "bombas de calor", "transformadores", "aire acondicionado", "plantas de emergencia", "subestaciones", "PTAR"…
  "equipos": ["…"],             // tipos de equipo que ha atendido: "chiller", "minisplit", "bomba sumergible"…
  "marcas": ["…"],              // marcas que menciona
  "certificaciones": ["…"],     // DC-3, cursos y certificaciones con su tema (y vigencia si la trae)
  "estudios": "…",              // máximo grado de estudios y carrera
  "aniosExperiencia": 0,        // años de experiencia en el ramo (número) o null
  "resumen": "…",               // 2 o 3 frases para quien asigna órdenes: fuerte, limitaciones, si puede ser encargado de brigada
  "lugarOrigen": "…",           // ciudad y estado donde vive, si aparece; si no, ""
  "regionesTrabajo": ["…"],     // estados o regiones donde ha trabajado o dice poder trabajar
  "advertencias": ["…"]         // documentos ilegibles, datos que no cuadran o que faltan (frases cortas)
}`

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar la clave de la IA (ANTHROPIC_API_KEY)." }, { status: 503 })
  }
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: "Técnico inválido." }, { status: 400 })

  // El técnico debe ser visible para el usuario (empresa activa, por RLS).
  const supabase = await createClient()
  const { data: tecnico } = await supabase.from("tecnicos").select("*").eq("id", id).maybeSingle()
  if (!tecnico) return NextResponse.json({ error: "El técnico no existe o no tienes acceso." }, { status: 404 })
  const { data: docs } = await supabase
    .from("tecnico_documentos")
    .select("tipo, nombre_archivo, storage_path, tamano_bytes, created_at")
    .eq("tecnico_id", id)
    .order("created_at", { ascending: false })

  const elegidos = (docs ?? [])
    .filter((d) => d.tamano_bytes <= MAX_BYTES && PRIORIDAD.includes(d.tipo))
    .sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo))
    .slice(0, MAX_DOCUMENTOS)

  const admin = adminClient()
  const contenido: Bloque[] = []
  for (const d of elegidos) {
    const { data: blob } = await admin.storage.from(BUCKET_EXPEDIENTES).download(d.storage_path)
    if (!blob) continue
    const bloques = await bloquesDeArchivo(Buffer.from(await blob.arrayBuffer()), `${d.tipo}: ${d.nombre_archivo}`)
    if (bloques) contenido.push(...bloques)
  }
  contenido.push({
    type: "text",
    text: `Datos de registro del técnico:
- Nombre: ${tecnico.nombre}
- Puesto: ${tecnico.rol}
- Especialidad registrada: ${tecnico.especialidad ?? ""}
- Zona: ${tecnico.zona ?? ""}
- Lugar de origen registrado: ${tecnico.lugar_origen ?? ""}
- Tiene cédula profesional: ${tecnico.tiene_cedula ? "sí" : "no"}
- Observaciones: ${tecnico.notas ?? ""}
${elegidos.length === 0 ? "\nNo hay documentos de expediente: arma el perfil solo con estos datos y avisa que falta el currículum." : ""}
Arma su perfil y responde solo con el objeto JSON.`,
  })

  try {
    const stream = new Anthropic().beta.messages.stream({
      model: MODELO_LECTURA,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: contenido }],
    })
    const respuesta = await stream.finalMessage()
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
    let crudo: any
    try {
      crudo = JSON.parse(extraerJson(texto))
    } catch {
      return NextResponse.json({ error: "No se pudo interpretar el perfil. Intenta de nuevo." }, { status: 502 })
    }
    const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [])
    return NextResponse.json({
      perfil: normalizarPerfil(crudo),
      lugarOrigen: typeof crudo?.lugarOrigen === "string" ? crudo.lugarOrigen.trim() : "",
      regionesTrabajo: lista(crudo?.regionesTrabajo).slice(0, 15),
      advertencias: lista(crudo?.advertencias),
      documentosLeidos: elegidos.length,
    })
  } catch (e) {
    console.error("[tecnicos/perfil]", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e)
    return NextResponse.json({ error: "La IA no pudo armar el perfil en este momento. Intenta de nuevo." }, { status: 502 })
  }
}

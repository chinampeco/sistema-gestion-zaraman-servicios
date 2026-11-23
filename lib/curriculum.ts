// Currículum de la empresa (tabla empresa_curriculum) y su experiencia: los
// contratos del sistema más los históricos capturados a mano o leídos con IA.

export interface ExperienciaExterna {
  cliente: string
  numero: string
  objeto: string
  /** "AAAA-MM" o "" */
  inicio: string
  fin: string
  monto: number | null
  /** Evidencia de cumplimiento: acta de aceptación, liberación de fianza… "" si no hay. */
  evidencia: string
}

export interface CurriculumEmpresa {
  semblanza: string
  especialidades: string[]
  infraestructura: string
  certificaciones: string[]
  experienciaExterna: ExperienciaExterna[]
  updatedAt: string | null
}

export const CURRICULUM_VACIO: CurriculumEmpresa = {
  semblanza: "",
  especialidades: [],
  infraestructura: "",
  certificaciones: [],
  experienciaExterna: [],
  updatedAt: null,
}

/** Una línea de experiencia ya unificada (contrato del sistema o histórico). */
export interface Experiencia {
  origen: "sistema" | "historico"
  contratoId: string | null
  cliente: string
  numero: string
  objeto: string
  inicio: string
  fin: string
  monto: number | null
  concluido: boolean
  evidencia: string
}

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim())
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : null
}
const lista = (v: unknown) => (Array.isArray(v) ? v.map(txt).filter(Boolean) : [])
/** Acepta "AAAA", "AAAA-MM" o "AAAA-MM-DD" y devuelve "AAAA-MM" (o "AAAA-01"). */
export function mes(v: unknown): string {
  const s = txt(v)
  const m = /^(\d{4})(?:-(\d{1,2}))?/.exec(s)
  if (!m) return ""
  return `${m[1]}-${String(Math.min(12, Math.max(1, Number(m[2] ?? 1)))).padStart(2, "0")}`
}

export function normalizarExperiencia(v: unknown): ExperienciaExterna[] {
  if (!Array.isArray(v)) return []
  return v
    .map((e: any) => ({
      cliente: txt(e?.cliente),
      numero: txt(e?.numero),
      objeto: txt(e?.objeto),
      inicio: mes(e?.inicio),
      fin: mes(e?.fin),
      monto: num(e?.monto),
      evidencia: txt(e?.evidencia),
    }))
    .filter((e) => e.cliente || e.objeto || e.numero)
}

export function mapCurriculum(r: Record<string, any> | null): CurriculumEmpresa {
  if (!r) return CURRICULUM_VACIO
  return {
    semblanza: txt(r.semblanza),
    especialidades: lista(r.especialidades),
    infraestructura: txt(r.infraestructura),
    certificaciones: lista(r.certificaciones),
    experienciaExterna: normalizarExperiencia(r.experiencia_externa),
    updatedAt: r.updated_at ?? null,
  }
}

/** Tipos de documento de un contrato que acreditan su cumplimiento. */
export const DOCUMENTOS_EVIDENCIA = ["Acta de entrega-recepción", "Constancia de recepción"]

export function experienciaDeContrato(c: Record<string, any>, tiposDocumentos: string[]): Experiencia {
  const evidencia = tiposDocumentos.filter((t) => DOCUMENTOS_EVIDENCIA.includes(t))
  return {
    origen: "sistema",
    contratoId: c.id,
    cliente: txt(c.cliente),
    numero: txt(c.numero_contrato),
    objeto: txt(c.objeto),
    inicio: mes(c.vigencia_inicio || c.fecha_firma),
    fin: mes(c.vigencia_fin),
    monto: num(c.total),
    concluido: c.estado === "Entregado" || c.estado === "Finiquitado",
    evidencia: [...new Set(evidencia)].join(", "),
  }
}

export function experienciaHistorica(e: ExperienciaExterna, hoy = new Date()): Experiencia {
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  return {
    origen: "historico",
    contratoId: null,
    ...e,
    concluido: !!e.fin && e.fin < mesActual,
  }
}

export interface ResumenExperiencia {
  recientes: Experiencia[]
  concluidosRecientes: number
  aniosDistintos: number
  conEvidencia: number
  consejos: string[]
}

/**
 * Lo que suelen pedir las convocatorias por puntos y porcentajes: contratos de los
 * últimos 5 años, concluidos, en años diferentes, con evidencia de cumplimiento
 * (en la N-702: 3 contratos en años distintos = 9 pts; 3 evidencias = 9 pts).
 */
export function resumirExperiencia(exp: Experiencia[], hoy = new Date()): ResumenExperiencia {
  const limite = `${hoy.getFullYear() - 5}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  const recientes = exp.filter((e) => (e.fin || e.inicio) >= limite)
  const concluidos = recientes.filter((e) => e.concluido)
  const anios = new Set(concluidos.map((e) => (e.inicio || e.fin).slice(0, 4)).filter(Boolean))
  const conEvidencia = concluidos.filter((e) => e.evidencia).length
  const consejos: string[] = []
  if (concluidos.length < 3) {
    consejos.push(
      `Faltan ${3 - concluidos.length} contrato(s) concluido(s) de los últimos 5 años. Carga los contratos anteriores (Contratos → Nuevo desde documentos, sin generar órdenes) o captúralos como históricos.`,
    )
  }
  if (anios.size < 3) {
    consejos.push(`Los contratos concluidos están en ${anios.size} año(s) distinto(s); para el máximo de especialidad suelen pedir 3 años diferentes.`)
  }
  if (conEvidencia < 3) {
    consejos.push(
      `Solo ${conEvidencia} contrato(s) concluido(s) tienen evidencia de cumplimiento. Sube el acta de aceptación, la constancia de recepción o la carta de liberación de fianza de cada uno.`,
    )
  }
  return { recientes, concluidosRecientes: concluidos.length, aniosDistintos: anios.size, conEvidencia, consejos }
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export function textoMes(m: string): string {
  if (!m) return ""
  const [a, mm] = m.split("-")
  return `${MESES[Number(mm) - 1] ?? ""} ${a}`.trim()
}
export function periodo(e: { inicio: string; fin: string }): string {
  if (!e.inicio && !e.fin) return "—"
  if (!e.fin) return `desde ${textoMes(e.inicio)}`
  if (!e.inicio) return `hasta ${textoMes(e.fin)}`
  return `${textoMes(e.inicio)} – ${textoMes(e.fin)}`
}

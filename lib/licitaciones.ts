// Módulo de Licitaciones: tipos, catálogos y utilidades compartidas por cliente y
// servidor. Tablas: licitaciones, licitacion_documentos, licitacion_requisitos y
// licitacion_eventos (archivos en expedientes/{empresa}/licitaciones/{id}/).

export const ESTADOS_LICITACION = [
  "En preparación",
  "Propuesta enviada",
  "En evaluación",
  "Ganada",
  "Ganada parcial",
  "Perdida",
  "Desechada",
  "Desierta",
  "Cancelada",
  "No participó",
] as const
export type EstadoLicitacion = (typeof ESTADOS_LICITACION)[number]

export const TIPOS_PROCEDIMIENTO = [
  "Licitación pública",
  "Invitación a cuando menos tres personas",
  "Adjudicación directa",
  "Otro",
] as const
export type TipoProcedimiento = (typeof TIPOS_PROCEDIMIENTO)[number]

export const TIPOS_DOCUMENTO_LICITACION = [
  "Convocatoria",
  "Anexo técnico",
  "Anexo administrativo",
  "Anexo de evaluación (puntos)",
  "Junta de aclaraciones",
  "Acta de apertura",
  "Acta de fallo",
  "Propuesta técnica",
  "Propuesta económica",
  "Documentación legal",
  "Acuse ComprasMX",
  "Evidencia de visita",
  "Contrato",
  "Otro",
] as const
export type TipoDocumentoLicitacion = (typeof TIPOS_DOCUMENTO_LICITACION)[number]

/** Documentos que la IA lee para armar requisitos, fechas y puntos. */
export const DOCUMENTOS_DE_BASES: TipoDocumentoLicitacion[] = [
  "Convocatoria",
  "Anexo técnico",
  "Anexo administrativo",
  "Anexo de evaluación (puntos)",
  "Junta de aclaraciones",
]

export const CATEGORIAS_REQUISITO = [
  "Legal y administrativo",
  "Técnico",
  "Económico",
  "Puntos",
  "Formalización",
  "Otro",
] as const
export type CategoriaRequisito = (typeof CATEGORIAS_REQUISITO)[number]

export const ESTADOS_REQUISITO = ["Pendiente", "En proceso", "Listo", "No aplica"] as const
export type EstadoRequisito = (typeof ESTADOS_REQUISITO)[number]

export const TIPOS_EVENTO = [
  "Publicación",
  "Límite de preguntas",
  "Junta de aclaraciones",
  "Visita de campo",
  "Presentación y apertura",
  "Fallo",
  "Entrega de documentos",
  "Firma de contrato",
  "Garantía de cumplimiento",
  "Entrega del servicio",
  "Otro",
] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export interface PartidaLicitacion {
  numero: number
  descripcion: string
  ubicacion: string
  ofertar: boolean
  precio_ofertado: number | null
}

export interface NivelPuntos {
  condicion: string
  puntos: number
}

export interface CriterioPuntos {
  rubro: string
  subrubro: string
  clave: string
  descripcion: string
  maximo: number
  como_acreditar: string
  niveles: NivelPuntos[]
}

export interface AnalisisLicitacion {
  resumen: string
  recomendaciones: string[]
  riesgos: string[]
  causales_desechamiento: string[]
  cambios_junta: string[]
}

export interface ResultadoPartida {
  partida: number
  resultado: "Ganada" | "Perdida" | "Desechada" | "No presentada" | ""
  puntos_tecnicos: number | null
  puntos_economicos: number | null
  total: number | null
  precio: number | null
  ganador: string
  precio_ganador: number | null
  total_ganador: number | null
  motivo: string
}

export interface PuntoPerdido {
  clave: string
  obtenidos: number | null
  maximo: number | null
  motivo: string
}

export interface ResultadoLicitacion {
  resumen: string
  nuestras: ResultadoPartida[]
  ganadores: { empresa: string; partidas: string; monto: number | null }[]
  puntos_perdidos: PuntoPerdido[]
  lecciones: string[]
}

export interface Licitacion {
  id: string
  empresaId: string
  numero: string
  expediente: string
  dependencia: string
  unidadCompradora: string
  objeto: string
  tipoProcedimiento: TipoProcedimiento
  caracter: string
  criterioEvaluacion: string
  estado: EstadoLicitacion
  puntosTecnicosMax: number | null
  puntosEconomicosMax: number | null
  partidas: PartidaLicitacion[]
  tablaPuntos: CriterioPuntos[]
  analisis: AnalisisLicitacion
  resultado: ResultadoLicitacion | null
  montoAdjudicado: number | null
  contratoId: string | null
  notas: string
  createdAt: string
}

/** Estado de la lectura con IA guardado en el documento (corre en segundo plano). */
export interface EstadoLectura {
  estado: "leyendo" | "lista" | "error"
  inicio: string
  fin: string | null
  error: string
  /** LecturaLicitacion sin normalizar (se normaliza al usarla). */
  lectura: unknown
}

/** Minutos tras los cuales una lectura "leyendo" se da por perdida. */
export const MINUTOS_MAX_LECTURA = 6

export function mapEstadoLectura(v: any): EstadoLectura | null {
  if (!v || typeof v !== "object" || !["leyendo", "lista", "error"].includes(v.estado)) return null
  return {
    estado: v.estado,
    inicio: String(v.inicio ?? ""),
    fin: v.fin ? String(v.fin) : null,
    error: typeof v.error === "string" ? v.error : "",
    lectura: v.lectura ?? null,
  }
}

export function lecturaVencida(e: EstadoLectura | null, ahora = Date.now()): boolean {
  return !!e && e.estado === "leyendo" && ahora - new Date(e.inicio).getTime() > MINUTOS_MAX_LECTURA * 60_000
}

export interface DocumentoLicitacion {
  id: string
  licitacionId: string
  tipo: TipoDocumentoLicitacion
  descripcion: string
  nombreArchivo: string
  storagePath: string
  mimeType: string
  tamanoBytes: number
  analizadoAt: string | null
  lectura: EstadoLectura | null
  createdAt: string
}

export interface RequisitoLicitacion {
  id: string
  licitacionId: string
  categoria: CategoriaRequisito
  numeral: string
  descripcion: string
  formato: string
  obligatorio: boolean
  desecha: boolean
  puntosMax: number | null
  puntosEsperados: number | null
  estado: EstadoRequisito
  documentoId: string | null
  empresaDocumentoId: string | null
  responsable: string
  notas: string
  orden: number
}

export interface EventoLicitacion {
  id: string
  licitacionId: string
  tipo: TipoEvento
  titulo: string
  fecha: string
  recordarDias: number
  completado: boolean
  notas: string
}

// ---------------------------------------------------------------- normalización

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim())
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : null
}
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(txt).filter(Boolean) : [])
const enLista = <T extends string>(v: unknown, opciones: readonly T[], defecto: T): T =>
  (opciones as readonly string[]).includes(v as string) ? (v as T) : defecto

export function normalizarPartidas(v: unknown): PartidaLicitacion[] {
  if (!Array.isArray(v)) return []
  return v
    .map((p: any, i) => ({
      numero: num(p?.numero) ?? i + 1,
      descripcion: txt(p?.descripcion),
      ubicacion: txt(p?.ubicacion),
      ofertar: p?.ofertar === true,
      precio_ofertado: num(p?.precio_ofertado),
    }))
    .filter((p) => p.descripcion || p.ubicacion)
}

export function normalizarTablaPuntos(v: unknown): CriterioPuntos[] {
  if (!Array.isArray(v)) return []
  return v
    .map((c: any) => ({
      rubro: txt(c?.rubro),
      subrubro: txt(c?.subrubro),
      clave: txt(c?.clave),
      descripcion: txt(c?.descripcion),
      maximo: num(c?.maximo) ?? 0,
      como_acreditar: txt(c?.como_acreditar),
      niveles: Array.isArray(c?.niveles)
        ? c.niveles.map((n: any) => ({ condicion: txt(n?.condicion), puntos: num(n?.puntos) ?? 0 })).filter((n: NivelPuntos) => n.condicion)
        : [],
    }))
    .filter((c) => c.descripcion || c.clave)
}

export function normalizarAnalisis(v: any): AnalisisLicitacion {
  return {
    resumen: txt(v?.resumen),
    recomendaciones: lista(v?.recomendaciones),
    riesgos: lista(v?.riesgos),
    causales_desechamiento: lista(v?.causales_desechamiento),
    cambios_junta: lista(v?.cambios_junta),
  }
}

export function normalizarResultado(v: any): ResultadoLicitacion | null {
  if (!v || typeof v !== "object" || (!v.resumen && !Array.isArray(v.nuestras))) return null
  return {
    resumen: txt(v.resumen),
    nuestras: Array.isArray(v.nuestras)
      ? v.nuestras.map((p: any) => ({
          partida: num(p?.partida) ?? 0,
          resultado: (["Ganada", "Perdida", "Desechada", "No presentada"].includes(p?.resultado) ? p.resultado : "") as ResultadoPartida["resultado"],
          puntos_tecnicos: num(p?.puntos_tecnicos),
          puntos_economicos: num(p?.puntos_economicos),
          total: num(p?.total),
          precio: num(p?.precio),
          ganador: txt(p?.ganador),
          precio_ganador: num(p?.precio_ganador),
          total_ganador: num(p?.total_ganador),
          motivo: txt(p?.motivo),
        }))
      : [],
    ganadores: Array.isArray(v.ganadores)
      ? v.ganadores.map((g: any) => ({ empresa: txt(g?.empresa), partidas: txt(g?.partidas), monto: num(g?.monto) })).filter((g: any) => g.empresa)
      : [],
    puntos_perdidos: Array.isArray(v.puntos_perdidos)
      ? v.puntos_perdidos.map((p: any) => ({ clave: txt(p?.clave), obtenidos: num(p?.obtenidos), maximo: num(p?.maximo), motivo: txt(p?.motivo) }))
      : [],
    lecciones: lista(v.lecciones),
  }
}

export function mapLicitacion(r: Record<string, any>): Licitacion {
  return {
    id: r.id,
    empresaId: String(r.empresa_id ?? ""),
    numero: txt(r.numero),
    expediente: txt(r.expediente),
    dependencia: txt(r.dependencia),
    unidadCompradora: txt(r.unidad_compradora),
    objeto: txt(r.objeto),
    tipoProcedimiento: enLista(r.tipo_procedimiento, TIPOS_PROCEDIMIENTO, "Licitación pública"),
    caracter: txt(r.caracter),
    criterioEvaluacion: txt(r.criterio_evaluacion),
    estado: enLista(r.estado, ESTADOS_LICITACION, "En preparación"),
    puntosTecnicosMax: num(r.puntos_tecnicos_max),
    puntosEconomicosMax: num(r.puntos_economicos_max),
    partidas: normalizarPartidas(r.partidas),
    tablaPuntos: normalizarTablaPuntos(r.tabla_puntos),
    analisis: normalizarAnalisis(r.analisis),
    resultado: normalizarResultado(r.resultado),
    montoAdjudicado: num(r.monto_adjudicado),
    contratoId: r.contrato_id ?? null,
    notas: txt(r.notas),
    createdAt: String(r.created_at ?? ""),
  }
}

export function mapDocumentoLicitacion(r: Record<string, any>): DocumentoLicitacion {
  return {
    id: r.id,
    licitacionId: String(r.licitacion_id ?? ""),
    tipo: enLista(r.tipo, TIPOS_DOCUMENTO_LICITACION, "Otro"),
    descripcion: txt(r.descripcion),
    nombreArchivo: txt(r.nombre_archivo),
    storagePath: txt(r.storage_path),
    mimeType: txt(r.mime_type),
    tamanoBytes: Number(r.tamano_bytes ?? 0),
    analizadoAt: r.analizado_at ?? null,
    lectura: mapEstadoLectura(r.lectura),
    createdAt: String(r.created_at ?? ""),
  }
}

export function mapRequisito(r: Record<string, any>): RequisitoLicitacion {
  return {
    id: r.id,
    licitacionId: String(r.licitacion_id ?? ""),
    categoria: enLista(r.categoria, CATEGORIAS_REQUISITO, "Otro"),
    numeral: txt(r.numeral),
    descripcion: txt(r.descripcion),
    formato: txt(r.formato),
    obligatorio: r.obligatorio !== false,
    desecha: r.desecha === true,
    puntosMax: num(r.puntos_max),
    puntosEsperados: num(r.puntos_esperados),
    estado: enLista(r.estado, ESTADOS_REQUISITO, "Pendiente"),
    documentoId: r.documento_id ?? null,
    empresaDocumentoId: r.empresa_documento_id ?? null,
    responsable: txt(r.responsable),
    notas: txt(r.notas),
    orden: Number(r.orden ?? 0),
  }
}

export function mapEvento(r: Record<string, any>): EventoLicitacion {
  return {
    id: r.id,
    licitacionId: String(r.licitacion_id ?? ""),
    tipo: enLista(r.tipo, TIPOS_EVENTO, "Otro"),
    titulo: txt(r.titulo),
    fecha: String(r.fecha ?? ""),
    recordarDias: Number(r.recordar_dias ?? 2),
    completado: r.completado === true,
    notas: txt(r.notas),
  }
}

// ---------------------------------------------------------------- utilidades

/** Puntos técnicos que se esperan con lo que ya está listo (requisitos de puntos). */
export function puntosEstimados(requisitos: RequisitoLicitacion[]): { esperados: number; posibles: number } {
  let esperados = 0
  let posibles = 0
  for (const r of requisitos) {
    if (r.puntosMax == null || r.estado === "No aplica") continue
    posibles += r.puntosMax
    if (r.estado === "Listo") esperados += r.puntosEsperados ?? r.puntosMax
  }
  return { esperados: Math.round(esperados * 100) / 100, posibles: Math.round(posibles * 100) / 100 }
}

const DIA = 86_400_000

/** Días (enteros, por calendario) que faltan para una fecha; negativo si ya pasó. */
export function diasPara(fechaIso: string, hoy = new Date()): number {
  const f = new Date(fechaIso)
  const a = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const b = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())
  return Math.round((b - a) / DIA)
}

/** El evento ya entró en su ventana de recordatorio (o está vencido y sin completar). */
export function eventoPorAtender(e: EventoLicitacion, hoy = new Date()): boolean {
  return !e.completado && diasPara(e.fecha, hoy) <= e.recordarDias
}

export function textoDias(dias: number): string {
  if (dias === 0) return "hoy"
  if (dias === 1) return "mañana"
  if (dias < 0) return `hace ${-dias} día${dias === -1 ? "" : "s"}`
  return `en ${dias} días`
}

export const ESTADOS_ABIERTOS: EstadoLicitacion[] = ["En preparación", "Propuesta enviada", "En evaluación"]

export function varianteEstado(e: EstadoLicitacion): "success" | "warning" | "destructive" | "info" | "secondary" {
  if (e === "Ganada" || e === "Ganada parcial") return "success"
  if (e === "Perdida" || e === "Desechada") return "destructive"
  if (e === "En preparación") return "warning"
  if (e === "Propuesta enviada" || e === "En evaluación") return "info"
  return "secondary"
}

/** Carpeta del expediente de una licitación. */
export function carpetaLicitacion(empresaId: string, licitacionId: string): string {
  return `${empresaId}/licitaciones/${licitacionId}`
}

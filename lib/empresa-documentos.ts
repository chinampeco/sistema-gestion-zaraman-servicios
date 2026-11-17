// Expediente corporativo por empresa (tabla empresa_documentos; archivos en el
// bucket privado "expedientes", carpeta {empresa_id}/empresa/).
//
// Las vigencias sugeridas son las usuales en convocatorias de ComprasMX; cada
// convocatoria puede pedir otra antigüedad, por eso "vigente hasta" se puede
// editar al subir el documento.

export const TIPOS_DOCUMENTO_EMPRESA = [
  "Opinión de cumplimiento SAT (32-D)",
  "Opinión de cumplimiento IMSS",
  "Constancia de situación INFONAVIT",
  "Constancia de situación fiscal",
  "Acta constitutiva",
  "Acta de asamblea / modificaciones",
  "Poder notarial del representante legal",
  "Identificación oficial del representante legal",
  "Comprobante de domicilio fiscal",
  "Vigencia de la e.firma",
  "Registro REPSE",
  "Estratificación MIPYME",
  "Carátula de estado de cuenta (CLABE)",
  "Declaración anual / estados financieros",
  "Registro patronal IMSS",
  "Registro ComprasMX / Registro Único de Participantes",
  "Currículum de la empresa",
  "Otro",
] as const
export type TipoDocumentoEmpresa = (typeof TIPOS_DOCUMENTO_EMPRESA)[number]

export type GrupoDocumento = "Cumplimiento (se renueva cada mes)" | "Legales" | "Fiscales y bancarios" | "Registros"

export interface InfoTipoDocumento {
  grupo: GrupoDocumento
  /** Lo piden en casi todas las licitaciones. */
  basico: boolean
  /** Días de vigencia sugeridos desde la emisión; null = no vence o depende del documento. */
  vigenciaDias: number | null
  ayuda: string
}

export const INFO_TIPO: Record<TipoDocumentoEmpresa, InfoTipoDocumento> = {
  "Opinión de cumplimiento SAT (32-D)": {
    grupo: "Cumplimiento (se renueva cada mes)", basico: true, vigenciaDias: 30,
    ayuda: "Portal del SAT → Opinión del cumplimiento. Debe ser POSITIVA y estar vigente al presentar y al firmar.",
  },
  "Opinión de cumplimiento IMSS": {
    grupo: "Cumplimiento (se renueva cada mes)", basico: true, vigenciaDias: 30,
    ayuda: "IMSS Digital → Opinión de cumplimiento de obligaciones en materia de seguridad social. En sentido positivo.",
  },
  "Constancia de situación INFONAVIT": {
    grupo: "Cumplimiento (se renueva cada mes)", basico: true, vigenciaDias: 30,
    ayuda: "Portal empresarial INFONAVIT → Constancia de situación fiscal (sin adeudo).",
  },
  "Constancia de situación fiscal": {
    grupo: "Fiscales y bancarios", basico: true, vigenciaDias: 30,
    ayuda: "Portal del SAT. Muchas convocatorias piden que sea reciente (del último mes).",
  },
  "Acta constitutiva": {
    grupo: "Legales", basico: true, vigenciaDias: null,
    ayuda: "Escritura constitutiva con datos de inscripción en el Registro Público de Comercio.",
  },
  "Acta de asamblea / modificaciones": {
    grupo: "Legales", basico: false, vigenciaDias: null,
    ayuda: "Cambios de socios, objeto social o administración, protocolizados.",
  },
  "Poder notarial del representante legal": {
    grupo: "Legales", basico: true, vigenciaDias: null,
    ayuda: "Poder para actos de administración o especial para licitaciones. Si se revoca, márcalo vencido.",
  },
  "Identificación oficial del representante legal": {
    grupo: "Legales", basico: true, vigenciaDias: null,
    ayuda: "INE o pasaporte vigente. Captura la fecha de vencimiento que trae la credencial.",
  },
  "Comprobante de domicilio fiscal": {
    grupo: "Fiscales y bancarios", basico: true, vigenciaDias: 90,
    ayuda: "No mayor a 3 meses (luz, agua, teléfono o predial).",
  },
  "Vigencia de la e.firma": {
    grupo: "Registros", basico: true, vigenciaDias: null,
    ayuda: "Sube una captura o PDF con los datos del certificado y su fecha de vencimiento. NUNCA subas la llave privada (.key) ni la contraseña.",
  },
  "Registro REPSE": {
    grupo: "Registros", basico: false, vigenciaDias: 1095,
    ayuda: "Registro de prestadoras de servicios especializados (STPS). Se renueva cada 3 años.",
  },
  "Estratificación MIPYME": {
    grupo: "Fiscales y bancarios", basico: true, vigenciaDias: 365,
    ayuda: "Escrito con el formato de la convocatoria y el resultado de la calculadora MIPYME. Da puntos extra.",
  },
  "Carátula de estado de cuenta (CLABE)": {
    grupo: "Fiscales y bancarios", basico: true, vigenciaDias: 90,
    ayuda: "Carátula reciente con CLABE a nombre de la empresa, para el pago.",
  },
  "Declaración anual / estados financieros": {
    grupo: "Fiscales y bancarios", basico: false, vigenciaDias: 365,
    ayuda: "Del último ejercicio. Algunas convocatorias evalúan capacidad económica.",
  },
  "Registro patronal IMSS": {
    grupo: "Registros", basico: false, vigenciaDias: null,
    ayuda: "Tarjeta de identificación patronal.",
  },
  "Registro ComprasMX / Registro Único de Participantes": {
    grupo: "Registros", basico: false, vigenciaDias: null,
    ayuda: "Constancia de alta en ComprasMX o de inscripción en el Registro Único de Participantes (antes RUPC).",
  },
  "Currículum de la empresa": {
    grupo: "Registros", basico: false, vigenciaDias: null,
    ayuda: "Experiencia, contratos realizados, personal e infraestructura.",
  },
  Otro: {
    grupo: "Registros", basico: false, vigenciaDias: null,
    ayuda: "Cualquier otro documento que pida una convocatoria.",
  },
}

export const GRUPOS: GrupoDocumento[] = [
  "Cumplimiento (se renueva cada mes)",
  "Legales",
  "Fiscales y bancarios",
  "Registros",
]

export interface DocumentoEmpresa {
  id: string
  empresaId: string
  tipo: TipoDocumentoEmpresa
  descripcion: string
  nombreArchivo: string
  storagePath: string
  mimeType: string
  tamanoBytes: number
  fechaEmision: string | null
  vigenteHasta: string | null
  notas: string
  createdAt: string
}

const fecha = (v: unknown) => (v ? String(v).slice(0, 10) : null)

export function mapDocumentoEmpresa(r: Record<string, any>): DocumentoEmpresa {
  return {
    id: r.id,
    empresaId: String(r.empresa_id ?? ""),
    tipo: (r.tipo ?? "Otro") as TipoDocumentoEmpresa,
    descripcion: r.descripcion ?? "",
    nombreArchivo: r.nombre_archivo ?? "",
    storagePath: r.storage_path ?? "",
    mimeType: r.mime_type ?? "",
    tamanoBytes: Number(r.tamano_bytes ?? 0),
    fechaEmision: fecha(r.fecha_emision),
    vigenteHasta: fecha(r.vigente_hasta),
    notas: r.notas ?? "",
    createdAt: String(r.created_at ?? ""),
  }
}

export type EstadoVigencia = "Vigente" | "Por vencer" | "Vencido" | "Sin vencimiento" | "Faltante"

/** Días antes del vencimiento en que se avisa "Por vencer". */
export const DIAS_AVISO = 7

/** Estado de un documento en una fecha de referencia (hoy o la de la licitación). */
export function estadoDocumento(doc: DocumentoEmpresa | undefined, referenciaISO: string): EstadoVigencia {
  if (!doc) return "Faltante"
  if (!doc.vigenteHasta) return "Sin vencimiento"
  const ref = new Date(`${referenciaISO}T00:00:00`).getTime()
  const fin = new Date(`${doc.vigenteHasta}T00:00:00`).getTime()
  const dias = Math.round((fin - ref) / 86_400_000)
  if (dias < 0) return "Vencido"
  if (dias <= DIAS_AVISO) return "Por vencer"
  return "Vigente"
}

/** El documento más reciente de cada tipo (el de vigencia más lejana; si no, el último subido). */
export function vigentePorTipo(docs: DocumentoEmpresa[]): Map<TipoDocumentoEmpresa, DocumentoEmpresa> {
  const mapa = new Map<TipoDocumentoEmpresa, DocumentoEmpresa>()
  for (const d of docs) {
    const actual = mapa.get(d.tipo)
    if (!actual) {
      mapa.set(d.tipo, d)
      continue
    }
    const a = actual.vigenteHasta ?? ""
    const b = d.vigenteHasta ?? ""
    if (b > a || (b === a && d.createdAt > actual.createdAt)) mapa.set(d.tipo, d)
  }
  return mapa
}

export function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

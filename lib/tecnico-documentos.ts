// Expediente de cada técnico (tabla tecnico_documentos; archivos en el bucket
// privado "expedientes", carpeta {empresa_id}/tecnicos/{tecnico_id}/).

export const TIPOS_DOCUMENTO_TECNICO = [
  "Currículum",
  "Cédula profesional",
  "Título / certificado de estudios",
  "Constancia DC-3",
  "Certificación / curso",
  "Identificación oficial (INE)",
  "CURP",
  "Alta IMSS / NSS",
  "Licencia de manejo",
  "Examen médico",
  "Constancia de antecedentes",
  "Otro",
] as const
export type TipoDocumentoTecnico = (typeof TIPOS_DOCUMENTO_TECNICO)[number]

export interface InfoTipoTecnico {
  /** Lo piden casi siempre las dependencias para dar acceso al técnico. */
  acceso: boolean
  /** Días de vigencia sugeridos desde la emisión; null = no vence o lo indica el documento. */
  vigenciaDias: number | null
  ayuda: string
}

export const INFO_TIPO_TECNICO: Record<TipoDocumentoTecnico, InfoTipoTecnico> = {
  Currículum: { acceso: false, vigenciaDias: null, ayuda: "Experiencia, empresas, proyectos y equipos que ha atendido. Con él la IA arma su perfil." },
  "Cédula profesional": { acceso: false, vigenciaDias: null, ayuda: "Necesaria si el contrato pide residente o ingeniero con cédula." },
  "Título / certificado de estudios": { acceso: false, vigenciaDias: null, ayuda: "Título, carta de pasante o certificado técnico." },
  "Constancia DC-3": { acceso: true, vigenciaDias: null, ayuda: "Constancia de competencias (STPS): trabajos en altura, eléctricos, espacios confinados, etc." },
  "Certificación / curso": { acceso: false, vigenciaDias: null, ayuda: "Certificaciones de fabricante o cursos. Captura la vigencia si la tiene." },
  "Identificación oficial (INE)": { acceso: true, vigenciaDias: null, ayuda: "Captura la vigencia que trae la credencial." },
  CURP: { acceso: false, vigenciaDias: null, ayuda: "Constancia de CURP." },
  "Alta IMSS / NSS": { acceso: true, vigenciaDias: null, ayuda: "Alta vigente en el IMSS; muchas dependencias la piden para entrar." },
  "Licencia de manejo": { acceso: false, vigenciaDias: null, ayuda: "Captura la vigencia que trae la licencia." },
  "Examen médico": { acceso: true, vigenciaDias: 365, ayuda: "Certificado médico de aptitud. Normalmente se renueva cada año." },
  "Constancia de antecedentes": { acceso: false, vigenciaDias: 90, ayuda: "Constancia de no antecedentes penales, si la dependencia la pide." },
  Otro: { acceso: false, vigenciaDias: null, ayuda: "Cualquier otro documento del técnico." },
}

export interface DocumentoTecnico {
  id: string
  tecnicoId: string
  tipo: TipoDocumentoTecnico
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

export function mapDocumentoTecnico(r: Record<string, any>): DocumentoTecnico {
  return {
    id: r.id,
    tecnicoId: String(r.tecnico_id ?? ""),
    tipo: (TIPOS_DOCUMENTO_TECNICO as readonly string[]).includes(r.tipo) ? r.tipo : "Otro",
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

/** Documentos de acceso vencidos o por vencer a la fecha dada (para avisar al asignar). */
export function documentosDeAccesoVencidos(docs: DocumentoTecnico[], referenciaISO: string): string[] {
  const vigentes = new Map<string, string | null>()
  for (const d of docs) {
    if (!INFO_TIPO_TECNICO[d.tipo].acceso) continue
    const actual = vigentes.get(d.tipo)
    // El documento más reciente de cada tipo (el de vigencia más lejana; sin fecha = no vence).
    if (actual === undefined || (actual !== null && (d.vigenteHasta === null || d.vigenteHasta > actual))) {
      vigentes.set(d.tipo, d.vigenteHasta)
    }
  }
  return [...vigentes.entries()].filter(([, hasta]) => hasta !== null && hasta < referenciaISO).map(([tipo]) => tipo)
}

// Lectura con IA de los documentos de la empresa (opiniones de cumplimiento,
// constancias, actas, poderes, identificaciones…): tipo, fechas, folio, RFC y
// sentido, para llenar el formulario de subida. Lo usan cliente y servidor.

import { TIPOS_DOCUMENTO_EMPRESA, type TipoDocumentoEmpresa } from "@/lib/empresa-documentos"

export interface LecturaDocumentoEmpresa {
  tipo: TipoDocumentoEmpresa
  fecha_emision: string
  /** Solo si el documento trae su propia fecha de vencimiento. */
  vigente_hasta: string
  folio: string
  /** "Positivo" / "Negativo" en opiniones de cumplimiento; "" en los demás. */
  sentido: "" | "Positivo" | "Negativo"
  rfc: string
  razon_social: string
  descripcion: string
  advertencias: string[]
}

const S = { type: "string" } as const
const FECHA = { type: "string", description: "AAAA-MM-DD, o \"\" si no aparece" } as const

export const ESQUEMA_DOCUMENTO_EMPRESA = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: [...TIPOS_DOCUMENTO_EMPRESA] },
    fecha_emision: FECHA,
    vigente_hasta: FECHA,
    folio: S,
    sentido: { type: "string", enum: ["", "Positivo", "Negativo"] },
    rfc: S,
    razon_social: S,
    descripcion: S,
    advertencias: { type: "array", items: S },
  },
  required: ["tipo", "fecha_emision", "vigente_hasta", "folio", "sentido", "rfc", "razon_social", "descripcion", "advertencias"],
  additionalProperties: false,
} as const

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const fecha = (v: unknown) => {
  const s = txt(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""
}

export function normalizarLecturaDocumento(raw: any): LecturaDocumentoEmpresa {
  const tipo = TIPOS_DOCUMENTO_EMPRESA.includes(raw?.tipo) ? (raw.tipo as TipoDocumentoEmpresa) : "Otro"
  const sentido = raw?.sentido === "Positivo" || raw?.sentido === "Negativo" ? raw.sentido : ""
  const emision = fecha(raw?.fecha_emision)
  let vigencia = fecha(raw?.vigente_hasta)
  if (vigencia && emision && vigencia < emision) vigencia = ""
  return {
    tipo,
    fecha_emision: emision,
    vigente_hasta: vigencia,
    folio: txt(raw?.folio),
    sentido,
    rfc: txt(raw?.rfc).toUpperCase().replace(/[^A-ZÑ&0-9]/g, ""),
    razon_social: txt(raw?.razon_social),
    descripcion: txt(raw?.descripcion).slice(0, 200),
    advertencias: (Array.isArray(raw?.advertencias) ? raw.advertencias : []).map(txt).filter(Boolean),
  }
}

/** Tipos de archivo que la IA puede leer (los demás solo se guardan). */
export const TIPOS_LEIBLES = ["application/pdf", "image/jpeg", "image/png"]

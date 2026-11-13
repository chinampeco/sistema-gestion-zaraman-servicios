// Contratos, partidas y expediente digital (tablas contratos, contrato_partidas
// y contrato_documentos; archivos en el bucket privado "expedientes").

import type { Ubicacion } from "@/lib/types"

export const PROCEDIMIENTOS = [
  "Licitación pública",
  "Invitación a cuando menos tres personas",
  "Adjudicación directa",
  "Otro",
] as const
export type Procedimiento = (typeof PROCEDIMIENTOS)[number]

export const CARACTERES = ["Nacional", "Internacional", "Internacional bajo tratados"] as const
export type Caracter = (typeof CARACTERES)[number]

export const ESTADOS_CONTRATO = [
  "Por iniciar",
  "En ejecución",
  "Entregado",
  "Finiquitado",
  "Rescindido",
  "Cancelado",
] as const
export type EstadoContrato = (typeof ESTADOS_CONTRATO)[number]

export const TIPOS_DOCUMENTO = [
  "Contrato",
  "Anexo técnico",
  "Propuesta técnica",
  "Propuesta económica",
  "Anexo administrativo",
  "Convocatoria",
  "Fallo",
  "Garantía de cumplimiento",
  "Garantía de calidad",
  "Convenio modificatorio",
  "Acta de entrega-recepción",
  "Constancia de recepción",
  "Informe de servicio",
  "CFDI",
  "Opinión de cumplimiento",
  "Otro",
] as const
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]

export const BUCKET_EXPEDIENTES = "expedientes"
export const TAMANO_MAXIMO_DOCUMENTO = 25 * 1024 * 1024
export const TIPOS_ARCHIVO_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
]
export const ACCEPT_DOCUMENTOS = ".pdf,.doc,.docx,.xls,.xlsx,.xml,.jpg,.jpeg,.png"

export interface Contrato {
  id: string
  empresaId: string
  clienteId: string
  numeroContrato: string
  objeto: string
  areaRequirente: string
  procedimiento: Procedimiento
  caracter: Caracter
  electronico: boolean
  fechaFirma: string | null
  vigenciaInicio: string | null
  vigenciaFin: string | null
  fechaLimiteEntrega: string | null
  subtotal: number
  iva: number
  total: number
  moneda: string
  anticipoPct: number
  garantiaCumplimientoPct: number | null
  garantiaCalidadMeses: number | null
  penaDiariaPct: number | null
  penaMaximaPct: number | null
  plazoPagoDiasHabiles: number | null
  administradorNombre: string
  administradorCargo: string
  lugarEjecucion: string
  contactoTelefono: string
  contactoEmail: string
  suficienciaPresupuestal: string
  estado: EstadoContrato
  notas: string
  createdAt: string
}

export interface EquipoPartida {
  descripcion: string
  cantidad: number
  marca: string
  modelo: string
  serie: string
  inventario: string
}

export interface ContratoPartida extends Ubicacion {
  id: string
  contratoId: string
  numero: number
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  importe: number
  cucop: string
  alcance: string
  lugarEjecucion: string
  equipos: EquipoPartida[]
}

export interface ContratoDocumento {
  id: string
  contratoId: string
  empresaId: string
  tipo: TipoDocumento
  nombreArchivo: string
  storagePath: string
  mimeType: string
  tamanoBytes: number
  fechaDocumento: string | null
  vigenteHasta: string | null
  notas: string
  createdAt: string
}

// Helpers -----------------------------------------------------------------

const txt = (v: unknown) => (v == null ? "" : String(v))
const fecha = (v: unknown) => (v == null || v === "" ? null : String(v).slice(0, 10))
const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v))
const numONull = (v: unknown) => (v == null || v === "" ? null : Number(v))

// DB -> App ---------------------------------------------------------------

export function mapContrato(r: Record<string, any>): Contrato {
  return {
    id: r.id,
    empresaId: txt(r.empresa_id),
    clienteId: txt(r.cliente_id),
    numeroContrato: txt(r.numero_contrato),
    objeto: txt(r.objeto),
    areaRequirente: txt(r.area_requirente),
    procedimiento: (r.procedimiento ?? "Adjudicación directa") as Procedimiento,
    caracter: (r.caracter ?? "Nacional") as Caracter,
    electronico: r.electronico !== false,
    fechaFirma: fecha(r.fecha_firma),
    vigenciaInicio: fecha(r.vigencia_inicio),
    vigenciaFin: fecha(r.vigencia_fin),
    fechaLimiteEntrega: fecha(r.fecha_limite_entrega),
    subtotal: num(r.subtotal),
    iva: num(r.iva),
    total: num(r.total),
    moneda: txt(r.moneda) || "MXN",
    anticipoPct: num(r.anticipo_pct),
    garantiaCumplimientoPct: numONull(r.garantia_cumplimiento_pct),
    garantiaCalidadMeses: numONull(r.garantia_calidad_meses),
    penaDiariaPct: numONull(r.pena_diaria_pct),
    penaMaximaPct: numONull(r.pena_maxima_pct),
    plazoPagoDiasHabiles: numONull(r.plazo_pago_dias_habiles),
    administradorNombre: txt(r.administrador_nombre),
    administradorCargo: txt(r.administrador_cargo),
    lugarEjecucion: txt(r.lugar_ejecucion),
    contactoTelefono: txt(r.contacto_telefono),
    contactoEmail: txt(r.contacto_email),
    suficienciaPresupuestal: txt(r.suficiencia_presupuestal),
    estado: (r.estado ?? "Por iniciar") as EstadoContrato,
    notas: txt(r.notas),
    createdAt: txt(r.created_at),
  }
}

function mapEquiposPartida(v: unknown): EquipoPartida[] {
  if (!Array.isArray(v)) return []
  return v.map((e: any) => ({
    descripcion: txt(e?.descripcion),
    cantidad: Number(e?.cantidad) > 0 ? Number(e.cantidad) : 1,
    marca: txt(e?.marca),
    modelo: txt(e?.modelo),
    serie: txt(e?.serie),
    inventario: txt(e?.inventario),
  }))
}

export function mapPartida(r: Record<string, any>): ContratoPartida {
  return {
    id: r.id,
    contratoId: txt(r.contrato_id),
    numero: num(r.numero),
    descripcion: txt(r.descripcion),
    unidad: txt(r.unidad) || "Servicio",
    cantidad: num(r.cantidad) || 1,
    precioUnitario: num(r.precio_unitario),
    importe: num(r.importe),
    cucop: txt(r.cucop),
    alcance: txt(r.alcance),
    lugarEjecucion: txt(r.lugar_ejecucion),
    equipos: mapEquiposPartida(r.equipos),
    region: txt(r.region),
    zona: txt(r.zona),
    instalacion: txt(r.instalacion),
    area: txt(r.area),
  }
}

export function mapDocumento(r: Record<string, any>): ContratoDocumento {
  return {
    id: r.id,
    contratoId: txt(r.contrato_id),
    empresaId: txt(r.empresa_id),
    tipo: (r.tipo ?? "Otro") as TipoDocumento,
    nombreArchivo: txt(r.nombre_archivo),
    storagePath: txt(r.storage_path),
    mimeType: txt(r.mime_type),
    tamanoBytes: num(r.tamano_bytes),
    fechaDocumento: fecha(r.fecha_documento),
    vigenteHasta: fecha(r.vigente_hasta),
    notas: txt(r.notas),
    createdAt: txt(r.created_at),
  }
}

// App -> DB ---------------------------------------------------------------

export type ContratoForm = Omit<Contrato, "id" | "empresaId" | "createdAt">

export function contratoToDb(c: Partial<ContratoForm>): Record<string, any> {
  const out: Record<string, any> = {}
  const map: Record<string, string> = {
    clienteId: "cliente_id",
    numeroContrato: "numero_contrato",
    objeto: "objeto",
    areaRequirente: "area_requirente",
    procedimiento: "procedimiento",
    caracter: "caracter",
    electronico: "electronico",
    fechaFirma: "fecha_firma",
    vigenciaInicio: "vigencia_inicio",
    vigenciaFin: "vigencia_fin",
    fechaLimiteEntrega: "fecha_limite_entrega",
    subtotal: "subtotal",
    iva: "iva",
    total: "total",
    moneda: "moneda",
    anticipoPct: "anticipo_pct",
    garantiaCumplimientoPct: "garantia_cumplimiento_pct",
    garantiaCalidadMeses: "garantia_calidad_meses",
    penaDiariaPct: "pena_diaria_pct",
    penaMaximaPct: "pena_maxima_pct",
    plazoPagoDiasHabiles: "plazo_pago_dias_habiles",
    administradorNombre: "administrador_nombre",
    administradorCargo: "administrador_cargo",
    lugarEjecucion: "lugar_ejecucion",
    contactoTelefono: "contacto_telefono",
    contactoEmail: "contacto_email",
    suficienciaPresupuestal: "suficiencia_presupuestal",
    estado: "estado",
    notas: "notas",
  }
  const fechas = new Set(["fechaFirma", "vigenciaInicio", "vigenciaFin", "fechaLimiteEntrega"])
  for (const [k, col] of Object.entries(map)) {
    const v = (c as Record<string, unknown>)[k]
    if (v === undefined) continue
    if (fechas.has(k)) out[col] = v ? v : null
    else if (typeof v === "string") out[col] = v.trim()
    else out[col] = v
  }
  return out
}

export type PartidaForm = Omit<ContratoPartida, "id" | "contratoId" | "importe">

export function partidaToDb(p: PartidaForm): Record<string, any> {
  return {
    numero: p.numero,
    descripcion: p.descripcion.trim(),
    unidad: p.unidad.trim() || "Servicio",
    cantidad: p.cantidad,
    precio_unitario: p.precioUnitario,
    cucop: p.cucop.trim(),
    alcance: p.alcance.trim(),
    lugar_ejecucion: p.lugarEjecucion.trim(),
    equipos: p.equipos
      .filter((e) => e.descripcion.trim() || e.serie.trim() || e.inventario.trim())
      .map((e) => ({
        descripcion: e.descripcion.trim(),
        cantidad: e.cantidad > 0 ? e.cantidad : 1,
        marca: e.marca.trim(),
        modelo: e.modelo.trim(),
        serie: e.serie.trim(),
        inventario: e.inventario.trim(),
      })),
    region: p.region.trim(),
    zona: p.zona.trim(),
    instalacion: p.instalacion.trim(),
    area: p.area.trim(),
  }
}

// Utilidades ---------------------------------------------------------------

export function formatoMoneda(valor: number, moneda = "MXN"): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "MXN" }).format(
    valor || 0,
  )
}

export function formatoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Nombre de archivo seguro para la ruta en el bucket (sin acentos ni espacios). */
export function nombreArchivoSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-120)
  return limpio || "documento"
}

/** Días que faltan para una fecha (negativo si ya pasó). */
export function diasPara(fechaISO: string | null): number | null {
  if (!fechaISO) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(`${fechaISO}T00:00:00`)
  return Math.round((f.getTime() - hoy.getTime()) / 86_400_000)
}

// Fase 3: lectura automática de contratos, fichas técnicas y pólizas.
//
// El navegador sube los archivos a una carpeta temporal del bucket privado
// "expedientes" ({empresa}/importaciones/{lote}/...) con URLs firmadas que
// emite el servidor; el servidor los lee y se los pasa a Claude, que devuelve
// una ExtraccionContrato. El usuario la revisa y al confirmar se crean el
// contrato, partidas, equipos, órdenes, garantías y el expediente.
//
// Este módulo no importa el SDK: lo usan cliente y servidor.

import {
  CARACTERES,
  ESTADOS_CONTRATO,
  PROCEDIMIENTOS,
  TIPOS_DOCUMENTO,
  type Caracter,
  type Procedimiento,
  type TipoDocumento,
} from "@/lib/contratos"

export const TIPOS_GARANTIA = [
  "Cumplimiento",
  "Calidad / vicios ocultos",
  "Anticipo",
  "Responsabilidad civil",
  "Otra",
] as const
export type TipoGarantia = (typeof TIPOS_GARANTIA)[number]

export const FORMAS_GARANTIA = [
  "Póliza de fianza",
  "Carta de crédito (Stand By)",
  "Cheque certificado",
  "Escrito libre",
  "Otra",
] as const
export type FormaGarantia = (typeof FORMAS_GARANTIA)[number]

export const ESTADOS_GARANTIA = [
  "Por tramitar",
  "Solicitada",
  "Emitida",
  "Entregada",
  "Liberada",
  "Cancelada",
  "Exceptuada",
] as const
export type EstadoGarantia = (typeof ESTADOS_GARANTIA)[number]

// Archivos que se pueden leer: PDF (también escaneados), Word e imágenes.
export const TIPOS_LECTURA = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "image/jpeg": "imagen",
  "image/png": "imagen",
} as const
export const ACCEPT_IMPORTACION = ".pdf,.docx,.jpg,.jpeg,.png"
export const MAX_ARCHIVOS_IMPORTACION = 6
export const MAX_BYTES_IMPORTACION = 20 * 1024 * 1024
// En base64 crecen ~33 %; la petición a la API admite hasta 32 MB.
export const MAX_BYTES_TOTAL_IMPORTACION = 22 * 1024 * 1024

export interface ExtraccionEquipo {
  descripcion: string
  cantidad: number
  marca: string
  modelo: string
  serie: string
  inventario: string
}

export interface ExtraccionActividad {
  numero: number
  titulo: string
  detalle: string[]
}

export interface ExtraccionPartida {
  numero: number
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  cucop: string
  alcance: string
  lugar_ejecucion: string
  ficha_tecnica: string
  nombre_proyecto: string
  region: string
  zona: string
  instalacion: string
  area: string
  equipos: ExtraccionEquipo[]
  actividades: ExtraccionActividad[]
}

export interface ExtraccionGarantia {
  tipo: TipoGarantia
  forma: FormaGarantia
  requerida: boolean
  porcentaje: number | null
  monto: number | null
  divisible: boolean
  beneficiaria: string
  afianzadora: string
  numero_poliza: string
  folio: string
  linea_validacion: string
  fecha_expedicion: string
  fecha_limite_entrega: string
  vigencia_hasta: string
  /** Índice del archivo (0..n-1) que es la póliza emitida, o -1. */
  archivo_poliza: number
}

export interface ExtraccionContrato {
  dependencia: { nombre: string; rfc: string; domicilio: string }
  contrato: {
    numero_contrato: string
    objeto: string
    area_requirente: string
    procedimiento: Procedimiento
    caracter: Caracter
    electronico: boolean
    fecha_firma: string
    vigencia_inicio: string
    vigencia_fin: string
    fecha_limite_entrega: string
    subtotal: number
    iva: number
    total: number
    moneda: string
    anticipo_pct: number
    garantia_cumplimiento_pct: number | null
    garantia_calidad_meses: number | null
    pena_diaria_pct: number | null
    pena_maxima_pct: number | null
    plazo_pago_dias_habiles: number | null
    administrador_nombre: string
    administrador_cargo: string
    lugar_ejecucion: string
    contacto_telefono: string
    contacto_email: string
    suficiencia_presupuestal: string
  }
  partidas: ExtraccionPartida[]
  garantias: ExtraccionGarantia[]
  /** Clasificación de cada archivo subido, en el mismo orden. */
  documentos: { indice: number; tipo: TipoDocumento; descripcion: string }[]
  /** Datos dudosos, ilegibles o que no cuadran (para revisar a mano). */
  advertencias: string[]
}

// JSON Schema para output_config.format. Todas las propiedades son obligatorias
// (los datos que no vienen en el documento se devuelven como "" o null).
const S = { type: "string" } as const
const N = { type: "number" } as const
const NN = { anyOf: [{ type: "number" }, { type: "null" }] } as const
const B = { type: "boolean" } as const
const FECHA = { type: "string", description: "AAAA-MM-DD, o \"\" si no aparece" } as const

function objeto(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false }
}

export const ESQUEMA_EXTRACCION = objeto({
  dependencia: objeto({ nombre: S, rfc: S, domicilio: S }),
  contrato: objeto({
    numero_contrato: S,
    objeto: S,
    area_requirente: S,
    procedimiento: { type: "string", enum: [...PROCEDIMIENTOS] },
    caracter: { type: "string", enum: [...CARACTERES] },
    electronico: B,
    fecha_firma: FECHA,
    vigencia_inicio: FECHA,
    vigencia_fin: FECHA,
    fecha_limite_entrega: FECHA,
    subtotal: N,
    iva: N,
    total: N,
    moneda: S,
    anticipo_pct: N,
    garantia_cumplimiento_pct: NN,
    garantia_calidad_meses: NN,
    pena_diaria_pct: NN,
    pena_maxima_pct: NN,
    plazo_pago_dias_habiles: NN,
    administrador_nombre: S,
    administrador_cargo: S,
    lugar_ejecucion: S,
    contacto_telefono: S,
    contacto_email: S,
    suficiencia_presupuestal: S,
  }),
  partidas: {
    type: "array",
    items: objeto({
      numero: N,
      descripcion: S,
      unidad: S,
      cantidad: N,
      precio_unitario: N,
      cucop: S,
      alcance: S,
      lugar_ejecucion: S,
      ficha_tecnica: S,
      nombre_proyecto: S,
      region: S,
      zona: S,
      instalacion: S,
      area: S,
      equipos: {
        type: "array",
        items: objeto({ descripcion: S, cantidad: N, marca: S, modelo: S, serie: S, inventario: S }),
      },
      actividades: {
        type: "array",
        items: objeto({ numero: N, titulo: S, detalle: { type: "array", items: S } }),
      },
    }),
  },
  garantias: {
    type: "array",
    items: objeto({
      tipo: { type: "string", enum: [...TIPOS_GARANTIA] },
      forma: { type: "string", enum: [...FORMAS_GARANTIA] },
      requerida: B,
      porcentaje: NN,
      monto: NN,
      divisible: B,
      beneficiaria: S,
      afianzadora: S,
      numero_poliza: S,
      folio: S,
      linea_validacion: S,
      fecha_expedicion: FECHA,
      fecha_limite_entrega: FECHA,
      vigencia_hasta: FECHA,
      archivo_poliza: { type: "integer", description: "Índice del archivo que es la póliza emitida; -1 si no se subió" },
    }),
  },
  documentos: {
    type: "array",
    items: objeto({
      indice: { type: "integer" },
      tipo: { type: "string", enum: [...TIPOS_DOCUMENTO] },
      descripcion: S,
    }),
  },
  advertencias: { type: "array", items: S },
})

// Normalización defensiva (el modelo cumple el esquema, pero los valores se
// recortan y se validan otra vez antes de mostrarlos o guardarlos).
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0)
const numN = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null)
const fecha = (v: unknown) => {
  const s = txt(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime()) ? s : ""
}
const enumDe = <T extends string>(lista: readonly T[], v: unknown, defecto: T): T =>
  (lista as readonly string[]).includes(v as string) ? (v as T) : defecto
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])

export function normalizarExtraccion(raw: any, totalArchivos: number): ExtraccionContrato {
  const c = raw?.contrato ?? {}
  const partidas: ExtraccionPartida[] = arr(raw?.partidas).map((p: any, i: number) => ({
    numero: Number.isInteger(p?.numero) && p.numero > 0 ? p.numero : i + 1,
    descripcion: txt(p?.descripcion),
    unidad: txt(p?.unidad) || "Servicio",
    cantidad: num(p?.cantidad) || 1,
    precio_unitario: num(p?.precio_unitario),
    cucop: txt(p?.cucop),
    alcance: txt(p?.alcance),
    lugar_ejecucion: txt(p?.lugar_ejecucion),
    ficha_tecnica: txt(p?.ficha_tecnica),
    nombre_proyecto: txt(p?.nombre_proyecto),
    region: txt(p?.region),
    zona: txt(p?.zona),
    instalacion: txt(p?.instalacion),
    area: txt(p?.area),
    equipos: arr(p?.equipos).map((e: any) => ({
      descripcion: txt(e?.descripcion),
      cantidad: Math.max(1, Math.round(num(e?.cantidad)) || 1),
      marca: txt(e?.marca),
      modelo: txt(e?.modelo),
      serie: txt(e?.serie),
      inventario: txt(e?.inventario),
    })),
    actividades: arr(p?.actividades).map((a: any, j: number) => ({
      numero: Number.isInteger(a?.numero) && a.numero > 0 ? a.numero : j + 1,
      titulo: txt(a?.titulo),
      detalle: arr(a?.detalle).map(txt).filter(Boolean),
    })),
  }))
  // Números de partida únicos (la base exige único por contrato).
  const usados = new Set<number>()
  for (const p of partidas) {
    while (usados.has(p.numero)) p.numero += 1
    usados.add(p.numero)
  }

  return {
    dependencia: {
      nombre: txt(raw?.dependencia?.nombre),
      rfc: txt(raw?.dependencia?.rfc).toUpperCase(),
      domicilio: txt(raw?.dependencia?.domicilio),
    },
    contrato: {
      numero_contrato: txt(c.numero_contrato),
      objeto: txt(c.objeto),
      area_requirente: txt(c.area_requirente),
      procedimiento: enumDe(PROCEDIMIENTOS, c.procedimiento, "Otro"),
      caracter: enumDe(CARACTERES, c.caracter, "Nacional"),
      electronico: c.electronico !== false,
      fecha_firma: fecha(c.fecha_firma),
      vigencia_inicio: fecha(c.vigencia_inicio),
      vigencia_fin: fecha(c.vigencia_fin),
      fecha_limite_entrega: fecha(c.fecha_limite_entrega),
      subtotal: num(c.subtotal),
      iva: num(c.iva),
      total: num(c.total),
      moneda: txt(c.moneda).toUpperCase() || "MXN",
      anticipo_pct: Math.min(100, num(c.anticipo_pct)),
      garantia_cumplimiento_pct: numN(c.garantia_cumplimiento_pct),
      garantia_calidad_meses: numN(c.garantia_calidad_meses),
      pena_diaria_pct: numN(c.pena_diaria_pct),
      pena_maxima_pct: numN(c.pena_maxima_pct),
      plazo_pago_dias_habiles: numN(c.plazo_pago_dias_habiles),
      administrador_nombre: txt(c.administrador_nombre),
      administrador_cargo: txt(c.administrador_cargo),
      lugar_ejecucion: txt(c.lugar_ejecucion),
      contacto_telefono: txt(c.contacto_telefono),
      contacto_email: txt(c.contacto_email),
      suficiencia_presupuestal: txt(c.suficiencia_presupuestal),
    },
    partidas,
    garantias: arr(raw?.garantias).map((g: any) => ({
      tipo: enumDe(TIPOS_GARANTIA, g?.tipo, "Otra"),
      forma: enumDe(FORMAS_GARANTIA, g?.forma, "Póliza de fianza"),
      requerida: g?.requerida !== false,
      porcentaje: numN(g?.porcentaje),
      monto: numN(g?.monto),
      divisible: g?.divisible !== false,
      beneficiaria: txt(g?.beneficiaria) || "Tesorería de la Federación",
      afianzadora: txt(g?.afianzadora),
      numero_poliza: txt(g?.numero_poliza),
      folio: txt(g?.folio),
      linea_validacion: txt(g?.linea_validacion),
      fecha_expedicion: fecha(g?.fecha_expedicion),
      fecha_limite_entrega: fecha(g?.fecha_limite_entrega),
      vigencia_hasta: fecha(g?.vigencia_hasta),
      archivo_poliza:
        Number.isInteger(g?.archivo_poliza) && g.archivo_poliza >= 0 && g.archivo_poliza < totalArchivos
          ? g.archivo_poliza
          : -1,
    })),
    documentos: Array.from({ length: totalArchivos }, (_, i) => {
      const d = arr(raw?.documentos).find((x: any) => x?.indice === i)
      return { indice: i, tipo: enumDe(TIPOS_DOCUMENTO, d?.tipo, "Otro"), descripcion: txt(d?.descripcion) }
    }),
    advertencias: arr(raw?.advertencias).map(txt).filter(Boolean),
  }
}

/** Número corto para referencias: "D.G.ADMÓN. SAE-245/P/2026" → "SAE-245". */
export function claveCortaContrato(numero: string): string {
  const m = numero.match(/([A-Z]{2,})[-\s]?(\d{1,5})/i)
  return m ? `${m[1].toUpperCase()}-${m[2]}` : numero.replace(/\s+/g, "").slice(0, 16)
}

/** Referencia de orden estilo TOLTECATL: P01.SAE-245-01. */
export function referenciaOrden(numeroContrato: string, partida: number, consecutivo = 1): string {
  const dos = (n: number) => String(n).padStart(2, "0")
  return `P${dos(partida)}.${claveCortaContrato(numeroContrato)}-${dos(consecutivo)}`
}

export const ESTADO_CONTRATO_INICIAL: (typeof ESTADOS_CONTRATO)[number] = "Por iniciar"

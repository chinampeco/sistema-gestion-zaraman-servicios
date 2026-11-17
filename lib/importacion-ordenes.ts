// Importación de órdenes de servicio físicas (escaneadas o fotografiadas, ya
// firmadas): la IA lee cada hoja y, tras la revisión del usuario, la orden se
// cierra como Terminada con su técnico, equipos y actividades, y el escaneo se
// guarda en el expediente del contrato.
//
// Este módulo no importa el SDK: lo usan cliente y servidor.

/** Máximo de archivos por lote (cada uno se analiza por separado). */
export const MAX_ARCHIVOS_ORDENES = 20
export const MAX_BYTES_TOTAL_ORDENES = 100 * 1024 * 1024

export interface EquipoLeido {
  descripcion: string
  marca: string
  modelo: string
  serie: string
  /** Número de inventario, S.I.L. o identificador de la dependencia. */
  inventario: string
}

export interface ActividadLeida {
  numero: number
  texto: string
  realizada: boolean
}

export interface OrdenLeida {
  /** Número de orden impreso (p. ej. "P01.SAE-245-01"). */
  referencia: string
  /** Folio del sistema si aparece (p. ej. "TOL-OS-000001"). */
  folio: string
  fecha: string
  numero_contrato: string
  partida: number | null
  dependencia: string
  instalacion: string
  area: string
  region: string
  zona: string
  descripcion: string
  equipos: EquipoLeido[]
  actividades: ActividadLeida[]
  observaciones: string
  /** Nombres de quienes entregaron el trabajo (técnicos). */
  tecnicos: string[]
  verifico: string
  recibio_area_tecnica: string
  recibio_area_usuaria: string
  /** Tiene firma de recibido de la dependencia. */
  firmada: boolean
}

export interface LecturaArchivo {
  ordenes: OrdenLeida[]
  advertencias: string[]
}

const S = { type: "string" } as const
const N = { type: "number" } as const
const NN = { anyOf: [{ type: "number" }, { type: "null" }] } as const
const B = { type: "boolean" } as const
const FECHA = { type: "string", description: "AAAA-MM-DD, o \"\" si no aparece" } as const
const LISTA_S = { type: "array", items: S } as const

function objeto(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false }
}

export const ESQUEMA_ORDENES = objeto({
  ordenes: {
    type: "array",
    items: objeto({
      referencia: S,
      folio: S,
      fecha: FECHA,
      numero_contrato: S,
      partida: NN,
      dependencia: S,
      instalacion: S,
      area: S,
      region: S,
      zona: S,
      descripcion: S,
      equipos: {
        type: "array",
        items: objeto({ descripcion: S, marca: S, modelo: S, serie: S, inventario: S }),
      },
      actividades: { type: "array", items: objeto({ numero: N, texto: S, realizada: B }) },
      observaciones: S,
      tecnicos: LISTA_S,
      verifico: S,
      recibio_area_tecnica: S,
      recibio_area_usuaria: S,
      firmada: B,
    }),
  },
  advertencias: LISTA_S,
})

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const fecha = (v: unknown) => {
  const s = txt(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""
}

/** Valida y completa la respuesta de la IA (nunca confía en su forma). */
export function normalizarLectura(raw: any): LecturaArchivo {
  return {
    ordenes: arr(raw?.ordenes).map((o: any) => ({
      referencia: txt(o?.referencia),
      folio: txt(o?.folio).toUpperCase(),
      fecha: fecha(o?.fecha),
      numero_contrato: txt(o?.numero_contrato),
      partida: Number.isFinite(o?.partida) && o.partida > 0 ? Math.trunc(o.partida) : null,
      dependencia: txt(o?.dependencia),
      instalacion: txt(o?.instalacion),
      area: txt(o?.area),
      region: txt(o?.region),
      zona: txt(o?.zona),
      descripcion: txt(o?.descripcion),
      equipos: arr(o?.equipos)
        .map((e: any) => ({
          descripcion: txt(e?.descripcion),
          marca: txt(e?.marca),
          modelo: txt(e?.modelo),
          serie: txt(e?.serie),
          inventario: txt(e?.inventario),
        }))
        .filter((e) => e.descripcion || e.serie || e.inventario),
      actividades: arr(o?.actividades).map((a: any, j: number) => ({
        numero: Number.isInteger(a?.numero) && a.numero > 0 ? a.numero : j + 1,
        texto: txt(a?.texto),
        realizada: a?.realizada === true,
      })),
      observaciones: txt(o?.observaciones),
      tecnicos: arr(o?.tecnicos).map(txt).filter(Boolean),
      verifico: txt(o?.verifico),
      recibio_area_tecnica: txt(o?.recibio_area_tecnica),
      recibio_area_usuaria: txt(o?.recibio_area_usuaria),
      firmada: o?.firmada === true,
    })),
    advertencias: arr(raw?.advertencias).map(txt).filter(Boolean),
  }
}

// ---------------------------------------------------------------------------
// Emparejamiento con lo que ya existe en el sistema

/** Minúsculas, sin acentos ni signos: para comparar textos escritos distinto. */
export function normalizarTexto(s: string): string {
  return s
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Para comparar referencias, folios, series e inventarios: solo letras y números. */
export function clave(s: string): string {
  return normalizarTexto(s).replace(/ /g, "")
}

const PALABRAS_VACIAS = new Set(["de", "del", "la", "las", "los", "y", "sgto", "cap", "tte", "ing", "lic", "arq"])

/**
 * Elige al técnico cuyo nombre comparte más palabras con el leído (al menos dos,
 * p. ej. nombre y apellido), tolerando abreviaturas y nombres incompletos.
 */
export function emparejarTecnico<T extends { id: string; nombre: string; activo?: boolean }>(
  nombre: string,
  tecnicos: T[],
): T | null {
  const leidas = new Set(normalizarTexto(nombre).split(" ").filter((p) => p.length > 1 && !PALABRAS_VACIAS.has(p)))
  if (leidas.size === 0) return null
  let mejor: T | null = null
  let puntos = 1
  for (const t of tecnicos) {
    const comunes = normalizarTexto(t.nombre)
      .split(" ")
      .filter((p) => leidas.has(p)).length
    if (comunes > puntos || (comunes === puntos && mejor && t.activo && !mejor.activo)) {
      mejor = t
      puntos = comunes
    }
  }
  return mejor
}

/** Claves (serie e inventario) de los equipos leídos en la hoja. */
export function clavesEquiposLeidos(equipos: EquipoLeido[]): Set<string> {
  const claves = new Set<string>()
  for (const e of equipos) {
    for (const v of [e.serie, e.inventario]) {
      const k = clave(v)
      if (k.length >= 4) claves.add(k)
    }
  }
  return claves
}

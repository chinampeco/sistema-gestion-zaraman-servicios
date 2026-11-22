// Lectura con IA de los documentos de una licitación (convocatoria, anexos, junta
// de aclaraciones, acta de fallo). Cada documento se lee por separado y su lectura
// se aplica (mezcla) sobre la licitación.

import {
  CATEGORIAS_REQUISITO,
  TIPOS_DOCUMENTO_LICITACION,
  TIPOS_EVENTO,
  TIPOS_PROCEDIMIENTO,
  normalizarAnalisis,
  normalizarPartidas,
  normalizarResultado,
  normalizarTablaPuntos,
  type AnalisisLicitacion,
  type CategoriaRequisito,
  type CriterioPuntos,
  type PartidaLicitacion,
  type ResultadoLicitacion,
  type TipoDocumentoLicitacion,
  type TipoEvento,
  type TipoProcedimiento,
} from "@/lib/licitaciones"

export interface EventoLeido {
  tipo: TipoEvento
  titulo: string
  fecha: string
  hora: string
  notas: string
}

export interface RequisitoLeido {
  categoria: CategoriaRequisito
  numeral: string
  descripcion: string
  formato: string
  obligatorio: boolean
  desecha: boolean
  puntos_max: number | null
}

export interface LecturaLicitacion {
  tipo_documento: TipoDocumentoLicitacion
  datos: {
    numero: string
    expediente: string
    dependencia: string
    unidad_compradora: string
    objeto: string
    tipo_procedimiento: TipoProcedimiento | ""
    caracter: string
    criterio_evaluacion: string
    puntos_tecnicos_max: number | null
    puntos_economicos_max: number | null
  }
  eventos: EventoLeido[]
  partidas: PartidaLicitacion[]
  tabla_puntos: CriterioPuntos[]
  requisitos: RequisitoLeido[]
  analisis: AnalisisLicitacion
  resultado: ResultadoLicitacion | null
  monto_adjudicado: number | null
  advertencias: string[]
}

const S = { type: "string" } as const
const N = { type: ["number", "null"] } as const
const LS = { type: "array", items: S } as const

export const ESQUEMA_LECTURA_LICITACION = {
  type: "object",
  properties: {
    tipo_documento: { type: "string", enum: [...TIPOS_DOCUMENTO_LICITACION] },
    datos: {
      type: "object",
      properties: {
        numero: S,
        expediente: S,
        dependencia: S,
        unidad_compradora: S,
        objeto: S,
        tipo_procedimiento: { type: "string", enum: ["", ...TIPOS_PROCEDIMIENTO] },
        caracter: S,
        criterio_evaluacion: S,
        puntos_tecnicos_max: N,
        puntos_economicos_max: N,
      },
      required: ["numero", "expediente", "dependencia", "unidad_compradora", "objeto", "tipo_procedimiento", "caracter", "criterio_evaluacion", "puntos_tecnicos_max", "puntos_economicos_max"],
    },
    eventos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: [...TIPOS_EVENTO] },
          titulo: S,
          fecha: { type: "string", description: "AAAA-MM-DD" },
          hora: { type: "string", description: "HH:MM (24 h) o \"\"" },
          notas: S,
        },
        required: ["tipo", "titulo", "fecha", "hora", "notas"],
      },
    },
    partidas: {
      type: "array",
      items: {
        type: "object",
        properties: { numero: { type: "number" }, descripcion: S, ubicacion: S },
        required: ["numero", "descripcion", "ubicacion"],
      },
    },
    tabla_puntos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rubro: S,
          subrubro: S,
          clave: S,
          descripcion: S,
          maximo: { type: "number" },
          como_acreditar: S,
          niveles: {
            type: "array",
            items: { type: "object", properties: { condicion: S, puntos: { type: "number" } }, required: ["condicion", "puntos"] },
          },
        },
        required: ["rubro", "subrubro", "clave", "descripcion", "maximo", "como_acreditar", "niveles"],
      },
    },
    requisitos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoria: { type: "string", enum: [...CATEGORIAS_REQUISITO] },
          numeral: S,
          descripcion: S,
          formato: S,
          obligatorio: { type: "boolean" },
          desecha: { type: "boolean" },
          puntos_max: N,
        },
        required: ["categoria", "numeral", "descripcion", "formato", "obligatorio", "desecha", "puntos_max"],
      },
    },
    analisis: {
      type: "object",
      properties: { resumen: S, recomendaciones: LS, riesgos: LS, causales_desechamiento: LS, cambios_junta: LS },
      required: ["resumen", "recomendaciones", "riesgos", "causales_desechamiento", "cambios_junta"],
    },
    resultado: {
      type: ["object", "null"],
      properties: {
        resumen: S,
        nuestras: {
          type: "array",
          items: {
            type: "object",
            properties: {
              partida: { type: "number" },
              resultado: { type: "string", enum: ["Ganada", "Perdida", "Desechada", "No presentada"] },
              puntos_tecnicos: N,
              puntos_economicos: N,
              total: N,
              precio: N,
              ganador: S,
              precio_ganador: N,
              total_ganador: N,
              motivo: S,
            },
            required: ["partida", "resultado", "puntos_tecnicos", "puntos_economicos", "total", "precio", "ganador", "precio_ganador", "total_ganador", "motivo"],
          },
        },
        ganadores: {
          type: "array",
          items: { type: "object", properties: { empresa: S, partidas: S, monto: N }, required: ["empresa", "partidas", "monto"] },
        },
        puntos_perdidos: {
          type: "array",
          items: {
            type: "object",
            properties: { clave: S, obtenidos: N, maximo: N, motivo: S },
            required: ["clave", "obtenidos", "maximo", "motivo"],
          },
        },
        lecciones: LS,
      },
      required: ["resumen", "nuestras", "ganadores", "puntos_perdidos", "lecciones"],
    },
    monto_adjudicado: N,
    advertencias: LS,
  },
  required: ["tipo_documento", "datos", "eventos", "partidas", "tabla_puntos", "requisitos", "analisis", "resultado", "monto_adjudicado", "advertencias"],
} as const

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : null
}
const en = <T extends string>(v: unknown, op: readonly T[], d: T): T => ((op as readonly string[]).includes(v as string) ? (v as T) : d)

export function normalizarLecturaLicitacion(raw: any): LecturaLicitacion {
  const d = raw?.datos ?? {}
  return {
    tipo_documento: en(raw?.tipo_documento, TIPOS_DOCUMENTO_LICITACION, "Otro"),
    datos: {
      numero: txt(d.numero),
      expediente: txt(d.expediente),
      dependencia: txt(d.dependencia),
      unidad_compradora: txt(d.unidad_compradora),
      objeto: txt(d.objeto),
      tipo_procedimiento: en(d.tipo_procedimiento, ["", ...TIPOS_PROCEDIMIENTO] as const, ""),
      caracter: txt(d.caracter),
      criterio_evaluacion: txt(d.criterio_evaluacion),
      puntos_tecnicos_max: num(d.puntos_tecnicos_max),
      puntos_economicos_max: num(d.puntos_economicos_max),
    },
    eventos: (Array.isArray(raw?.eventos) ? raw.eventos : [])
      .map((e: any) => ({
        tipo: en(e?.tipo, TIPOS_EVENTO, "Otro"),
        titulo: txt(e?.titulo),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(txt(e?.fecha)) ? txt(e?.fecha) : "",
        hora: /^\d{1,2}:\d{2}$/.test(txt(e?.hora)) ? txt(e?.hora).padStart(5, "0") : "",
        notas: txt(e?.notas),
      }))
      .filter((e: EventoLeido) => e.fecha),
    partidas: normalizarPartidas(raw?.partidas),
    tabla_puntos: normalizarTablaPuntos(raw?.tabla_puntos),
    requisitos: (Array.isArray(raw?.requisitos) ? raw.requisitos : [])
      .map((r: any) => ({
        categoria: en(r?.categoria, CATEGORIAS_REQUISITO, "Otro"),
        numeral: txt(r?.numeral),
        descripcion: txt(r?.descripcion),
        formato: txt(r?.formato),
        obligatorio: r?.obligatorio !== false,
        desecha: r?.desecha === true,
        puntos_max: num(r?.puntos_max),
      }))
      .filter((r: RequisitoLeido) => r.descripcion),
    analisis: normalizarAnalisis(raw?.analisis),
    resultado: normalizarResultado(raw?.resultado),
    monto_adjudicado: num(raw?.monto_adjudicado),
    advertencias: Array.isArray(raw?.advertencias) ? raw.advertencias.map(txt).filter(Boolean) : [],
  }
}

/** Clave para no duplicar requisitos al leer varios documentos. */
export function claveRequisito(r: { numeral: string; descripcion: string; formato: string }): string {
  const base = (r.formato || r.numeral || r.descripcion.slice(0, 60))
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  return base
}

/** Mezcla listas de texto sin repetir. */
export function unirListas(a: string[], b: string[]): string[] {
  const vistos = new Set(a.map((x) => x.toLocaleLowerCase("es-MX")))
  return [...a, ...b.filter((x) => !vistos.has(x.toLocaleLowerCase("es-MX")))]
}

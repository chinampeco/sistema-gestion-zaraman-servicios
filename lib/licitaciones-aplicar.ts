// Aplica la lectura de un documento (IA) sobre la licitación: completa datos,
// mezcla partidas, tabla de puntos y análisis, y agrega requisitos y fechas
// nuevos sin duplicar. Corre en el navegador con la sesión del usuario (RLS).

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  CriterioPuntos,
  EstadoLicitacion,
  EventoLicitacion,
  Licitacion,
  PartidaLicitacion,
  RequisitoLicitacion,
} from "@/lib/licitaciones"
import { claveRequisito, unirListas, type EventoLeido, type LecturaLicitacion } from "@/lib/licitaciones-lectura"

export interface SeccionesAplicar {
  datos: boolean
  fechas: boolean
  partidas: boolean
  puntos: boolean
  requisitos: boolean
  analisis: boolean
  resultado: boolean
}

export interface ResumenAplicacion {
  requisitosNuevos: number
  fechasNuevas: number
  partidasNuevas: number
  criteriosNuevos: number
}

/** Fecha y hora de la convocatoria (hora del centro de México, UTC-6). */
export function fechaEvento(e: Pick<EventoLeido, "fecha" | "hora">): string {
  return `${e.fecha}T${e.hora || "09:00"}:00-06:00`
}

const dia = (iso: string) => new Date(iso).toISOString().slice(0, 10)

export function requisitosNuevos(lectura: LecturaLicitacion, existentes: RequisitoLicitacion[]) {
  const vistos = new Set(existentes.map((r) => claveRequisito(r)))
  return lectura.requisitos.filter((r) => {
    const k = claveRequisito(r)
    if (!k || vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

export function eventosNuevos(lectura: LecturaLicitacion, existentes: EventoLicitacion[]) {
  const vistos = new Set(existentes.map((e) => `${e.tipo}|${dia(e.fecha)}`))
  return lectura.eventos.filter((e) => {
    const k = `${e.tipo}|${dia(fechaEvento(e))}`
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

function mezclarPartidas(actuales: PartidaLicitacion[], leidas: PartidaLicitacion[]): PartidaLicitacion[] {
  const porNumero = new Map(actuales.map((p) => [p.numero, { ...p }]))
  for (const p of leidas) {
    const a = porNumero.get(p.numero)
    if (!a) porNumero.set(p.numero, { ...p, ofertar: false, precio_ofertado: null })
    else {
      a.descripcion ||= p.descripcion
      a.ubicacion ||= p.ubicacion
    }
  }
  return [...porNumero.values()].sort((a, b) => a.numero - b.numero)
}

function mezclarPuntos(actuales: CriterioPuntos[], leidos: CriterioPuntos[]): CriterioPuntos[] {
  if (!actuales.length) return leidos
  const clave = (c: CriterioPuntos) => (c.clave || `${c.rubro}|${c.subrubro}|${c.descripcion}`).toLowerCase()
  const vistos = new Set(actuales.map(clave))
  return [...actuales, ...leidos.filter((c) => !vistos.has(clave(c)))]
}

/**
 * Un requisito de categoría "Puntos" por cada criterio de la tabla que aún no
 * tenga uno (se busca su clave en el numeral, formato o descripción). Con ellos
 * se calculan los puntos técnicos asegurados.
 */
export function requisitosDePuntos(tabla: CriterioPuntos[], existentes: { numeral: string; formato: string; descripcion: string }[]) {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "")
  const textos = existentes.map((r) => norm(`${r.numeral} ${r.formato} ${r.descripcion}`))
  return tabla
    .filter((c) => c.clave && c.maximo > 0 && !textos.some((t) => t.includes(norm(c.clave))))
    .map((c) => ({
      categoria: "Puntos" as const,
      numeral: c.clave,
      descripcion: [c.subrubro || c.descripcion, c.como_acreditar].filter(Boolean).join(": "),
      formato: "",
      obligatorio: c.maximo > 0.1,
      desecha: false,
      puntos_max: c.maximo,
    }))
}

/** Estado sugerido con el resultado del fallo. */
export function estadoPorResultado(lectura: LecturaLicitacion): EstadoLicitacion | null {
  const nuestras = lectura.resultado?.nuestras ?? []
  if (!nuestras.length) return null
  const ganadas = nuestras.filter((p) => p.resultado === "Ganada").length
  if (ganadas === nuestras.length) return "Ganada"
  if (ganadas > 0) return "Ganada parcial"
  if (nuestras.every((p) => p.resultado === "Desechada")) return "Desechada"
  return "Perdida"
}

export async function aplicarLectura(
  supabase: SupabaseClient,
  lic: Licitacion,
  lectura: LecturaLicitacion,
  requisitos: RequisitoLicitacion[],
  eventos: EventoLicitacion[],
  s: SeccionesAplicar,
): Promise<{ ok: true; resumen: ResumenAplicacion } | { ok: false; error: string }> {
  const cambios: Record<string, unknown> = {}
  const d = lectura.datos
  if (s.datos) {
    const completar = (col: string, actual: string, nuevo: string) => {
      if (!actual && nuevo) cambios[col] = nuevo
    }
    completar("numero", lic.numero, d.numero)
    completar("expediente", lic.expediente, d.expediente)
    completar("dependencia", lic.dependencia, d.dependencia)
    completar("unidad_compradora", lic.unidadCompradora, d.unidad_compradora)
    completar("objeto", lic.objeto, d.objeto)
    completar("caracter", lic.caracter, d.caracter)
    completar("criterio_evaluacion", lic.criterioEvaluacion, d.criterio_evaluacion)
    if (d.tipo_procedimiento && lic.tipoProcedimiento === "Licitación pública" && d.tipo_procedimiento !== lic.tipoProcedimiento) {
      cambios.tipo_procedimiento = d.tipo_procedimiento
    }
    if (lic.puntosTecnicosMax == null && d.puntos_tecnicos_max != null) cambios.puntos_tecnicos_max = d.puntos_tecnicos_max
    if (lic.puntosEconomicosMax == null && d.puntos_economicos_max != null) cambios.puntos_economicos_max = d.puntos_economicos_max
  }

  let partidasNuevas = 0
  if (s.partidas && lectura.partidas.length) {
    const mezcla = mezclarPartidas(lic.partidas, lectura.partidas)
    partidasNuevas = mezcla.length - lic.partidas.length
    cambios.partidas = mezcla
  }

  let criteriosNuevos = 0
  if (s.puntos && lectura.tabla_puntos.length) {
    const mezcla = mezclarPuntos(lic.tablaPuntos, lectura.tabla_puntos)
    criteriosNuevos = mezcla.length - lic.tablaPuntos.length
    cambios.tabla_puntos = mezcla
  }

  if (s.analisis) {
    const a = lic.analisis
    const l = lectura.analisis
    cambios.analisis = {
      resumen: a.resumen || l.resumen,
      recomendaciones: unirListas(a.recomendaciones, l.recomendaciones),
      riesgos: unirListas(a.riesgos, l.riesgos),
      causales_desechamiento: unirListas(a.causales_desechamiento, l.causales_desechamiento),
      cambios_junta: unirListas(a.cambios_junta, l.cambios_junta),
    }
  }

  if (s.resultado && lectura.resultado) {
    cambios.resultado = lectura.resultado
    if (lectura.monto_adjudicado != null) cambios.monto_adjudicado = lectura.monto_adjudicado
    const estado = estadoPorResultado(lectura)
    if (estado) cambios.estado = estado
  }

  if (Object.keys(cambios).length) {
    const { error } = await supabase.from("licitaciones").update(cambios).eq("id", lic.id)
    if (error) {
      return {
        ok: false,
        error: /licitaciones_numero_unico/.test(error.message)
          ? `Ya hay otra licitación con el número ${d.numero} en esta empresa.`
          : "No se pudieron guardar los datos de la licitación.",
      }
    }
  }

  let nReq = 0
  if (s.requisitos || s.puntos) {
    const nuevos = [
      ...(s.requisitos ? requisitosNuevos(lectura, requisitos) : []),
      ...(s.puntos ? requisitosDePuntos(lectura.tabla_puntos, [...requisitos, ...(s.requisitos ? requisitosNuevos(lectura, requisitos) : [])]) : []),
    ]
    if (nuevos.length) {
      const base = requisitos.reduce((m, r) => Math.max(m, r.orden), 0)
      const { error } = await supabase.from("licitacion_requisitos").insert(
        nuevos.map((r, i) => ({
          licitacion_id: lic.id,
          categoria: r.categoria,
          numeral: r.numeral,
          descripcion: r.descripcion,
          formato: r.formato,
          obligatorio: r.obligatorio,
          desecha: r.desecha,
          puntos_max: r.puntos_max,
          orden: base + i + 1,
        })),
      )
      if (error) return { ok: false, error: "Se guardaron los datos, pero no los requisitos." }
      nReq = nuevos.length
    }
  }

  let nEv = 0
  if (s.fechas) {
    const nuevos = eventosNuevos(lectura, eventos)
    if (nuevos.length) {
      const { error } = await supabase.from("licitacion_eventos").insert(
        nuevos.map((e) => ({
          licitacion_id: lic.id,
          tipo: e.tipo,
          titulo: e.titulo || e.tipo,
          fecha: fechaEvento(e),
          notas: e.notas,
          recordar_dias: e.tipo === "Presentación y apertura" ? 5 : e.tipo === "Firma de contrato" ? 3 : 2,
          completado: new Date(fechaEvento(e)).getTime() < Date.now(),
        })),
      )
      if (error) return { ok: false, error: "Se guardaron los datos, pero no las fechas." }
      nEv = nuevos.length
    }
  }

  return { ok: true, resumen: { requisitosNuevos: nReq, fechasNuevas: nEv, partidasNuevas, criteriosNuevos } }
}

// Sugerencia del técnico más apto para una orden. Es solo una ayuda para quien
// asigna: califica de 0 a 100 con
//   · Currículum / especialidad (35): su perfil contra el equipo y las actividades.
//   · Experiencia real (30): sus órdenes terminadas parecidas (más peso las de contrato).
//   · Ubicación (20): lugar de origen y regiones de trabajo contra la ubicación de la orden.
//   · Carga de trabajo (15): órdenes abiertas y choques de fecha.
// y descuenta retrabajos (órdenes que regresaron por garantía) y documentos de
// acceso vencidos (INE, alta IMSS, DC-3, examen médico).

import type { Cliente, Equipo, OrdenServicio, Tecnico } from "@/lib/types"

export interface Sugerencia {
  tecnico: Tecnico
  puntos: number
  motivos: string[]
  alertas: string[]
}

export interface ContextoSugerencia {
  tecnicos: Tecnico[]
  ordenes: OrdenServicio[]
  equipos: Equipo[]
  clientes: Cliente[]
  /** ids de órdenes que tuvieron que atenderse de nuevo por garantía. */
  ordenesConRetrabajo: Set<string>
  /** tecnicoId → tipos de documento de acceso vencidos a hoy. */
  documentosVencidos: Map<string, string[]>
}

const VACIAS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "a", "en", "con", "para", "por", "un", "una", "uno", "al", "su", "sus",
  "mantenimiento", "servicio", "servicios", "preventivo", "correctivo", "partida", "equipo", "equipos", "suministro",
  "instalacion", "general", "revision", "trabajos", "realizar", "conforme", "cinco", "dos", "tres", "cuatro",
])

export function normalizar(s: string): string {
  return s.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()
}

/** Palabras significativas (sin acentos, sin palabras vacías, raíz simple de plurales). */
function palabras(s: string): Set<string> {
  return new Set(
    normalizar(s)
      .split(" ")
      .filter((p) => p.length > 3 && !VACIAS.has(p) && !/^\d+$/.test(p))
      .map((p) => p.replace(/(es|s)$/, "")),
  )
}

function textoOrden(o: OrdenServicio, equipos: Equipo[]): string {
  const eq = equipos.find((e) => e.id === o.equipoId)
  return [
    o.descripcionFalla,
    o.trabajoRealizado,
    ...(o.actividades ?? []).flatMap((a) => [a.titulo, ...a.detalle]),
    eq ? `${eq.tipo} ${eq.marca} ${eq.modelo}` : "",
  ].join(" ")
}

function textoUbicacion(o: OrdenServicio, clientes: Cliente[]): string {
  const c = clientes.find((x) => x.id === o.clienteId)
  return normalizar([o.region, o.zona, o.instalacion, o.area, c?.direccion ?? "", c?.nombre ?? ""].join(" "))
}

/** ¿Alguna de las frases del técnico aparece en el texto (completa o por palabras)? */
function coincide(frase: string, texto: string, palabrasTexto: Set<string>): boolean {
  const f = normalizar(frase)
  if (f.length < 3) return false
  if (` ${texto} `.includes(` ${f} `)) return true
  const ps = [...palabras(frase)]
  return ps.length > 0 && ps.every((p) => palabrasTexto.has(p))
}

const ABIERTAS = new Set(["Asignada", "Programada", "En camino", "En proceso", "En espera", "Pendiente"])

export function sugerirTecnicos(orden: OrdenServicio, ctx: ContextoSugerencia, cuantos = 3): Sugerencia[] {
  const texto = normalizar(textoOrden(orden, ctx.equipos))
  const palabrasOrden = palabras(texto)
  const ubicacion = textoUbicacion(orden, ctx.clientes)
  const palabrasUbicacion = palabras(ubicacion)
  const equipoOrden = ctx.equipos.find((e) => e.id === orden.equipoId)

  const resultados = ctx.tecnicos
    .filter((t) => t.activo)
    .map((t): Sugerencia => {
      const motivos: string[] = []
      const alertas: string[] = []
      const perfil = t.perfil

      // 1. Currículum / especialidad (35)
      const terminos = [
        ...(perfil?.especialidades ?? []),
        ...(perfil?.equipos ?? []),
        ...(perfil?.certificaciones ?? []),
        ...t.especialidad.split(/[,;/]| y /),
      ].filter((x) => x && x.trim())
      const aciertos = [...new Set(terminos.filter((x) => coincide(x, texto, palabrasOrden)).map((x) => x.trim()))]
      const marca = (perfil?.marcas ?? []).find((m) => m && equipoOrden && normalizar(m) === normalizar(equipoOrden.marca))
      const puntosCv = Math.min(35, aciertos.length * 12 + (marca ? 8 : 0))
      if (aciertos.length) motivos.push(`Su perfil incluye ${aciertos.slice(0, 3).join(", ")}`)
      if (marca) motivos.push(`Conoce la marca ${marca}`)
      if (!perfil?.especialidades?.length && !perfil?.equipos?.length) {
        alertas.push("Sin perfil: sube su CV y genera su perfil")
      }

      // 2. Experiencia real (30)
      const suyas = ctx.ordenes.filter((o) => o.tecnicoId === t.id && o.id !== orden.id)
      const terminadas = suyas.filter((o) => o.estado === "Terminada")
      let similares = 0
      let parecidas = 0
      let deContrato = 0
      for (const o of terminadas) {
        const comunes = [...palabras(textoOrden(o, ctx.equipos))].filter((p) => palabrasOrden.has(p)).length
        const tipoAnterior = ctx.equipos.find((e) => e.id === o.equipoId)?.tipo
        const mismoEquipo = !!equipoOrden?.tipo && !!tipoAnterior && normalizar(tipoAnterior) === normalizar(equipoOrden.tipo)
        if (comunes >= 2 || mismoEquipo) {
          similares += o.contratoId ? 1.5 : 1
          parecidas++
          if (o.contratoId) deContrato++
        }
      }
      const puntosExp = Math.min(30, Math.round(similares * 8) + Math.min(6, terminadas.length))
      if (parecidas > 0) {
        motivos.push(
          `${parecidas} servicio(s) terminado(s) parecido(s)` +
            (deContrato ? `, ${deContrato} de contrato` : "") +
            ` (de ${terminadas.length} terminados)`,
        )
      } else if (terminadas.length) {
        motivos.push(`${terminadas.length} servicio(s) terminado(s)`)
      }

      // 3. Ubicación (20)
      const lugares = [t.lugarOrigen ?? "", ...(t.regionesTrabajo ?? []), t.zona].filter((x) => x && x.trim())
      let puntosUbi = 0
      if (!ubicacion || lugares.length === 0) {
        puntosUbi = 8 // sin datos para comparar
      } else {
        const cerca = lugares.find((l) => coincide(l, ubicacion, palabrasUbicacion) || l.split(",").some((p) => coincide(p, ubicacion, palabrasUbicacion)))
        if (cerca) {
          puntosUbi = 20
          motivos.push(`Trabaja en ${cerca.trim()}`)
        }
      }

      // 4. Carga de trabajo (15)
      const abiertas = suyas.filter((o) => ABIERTAS.has(o.estado))
      let puntosCarga = [15, 11, 7, 4][abiertas.length] ?? 0
      motivos.push(abiertas.length ? `${abiertas.length} orden(es) abierta(s)` : "Sin órdenes abiertas")
      if (orden.fechaProgramada && abiertas.some((o) => o.fechaProgramada === orden.fechaProgramada)) {
        puntosCarga = Math.max(0, puntosCarga - 5)
        alertas.push(`Ya tiene otra orden programada el ${orden.fechaProgramada}`)
      }

      // Ajustes
      let ajuste = 0
      const retrabajos = terminadas.filter((o) => ctx.ordenesConRetrabajo.has(o.id)).length
      if (retrabajos) {
        ajuste -= Math.min(15, retrabajos * 5)
        alertas.push(`${retrabajos} servicio(s) regresaron por garantía`)
      }
      const vencidos = ctx.documentosVencidos.get(t.id) ?? []
      if (vencidos.length) {
        ajuste -= 5
        alertas.push(`Documentos vencidos: ${vencidos.join(", ")}`)
      }
      if (orden.contratoId && (t.tieneCedula || t.rol === "Residente de Obra")) {
        ajuste += 3
        motivos.push(t.tieneCedula ? "Con cédula profesional" : "Residente de obra")
      }

      const puntos = Math.max(0, Math.min(100, puntosCv + puntosExp + puntosUbi + puntosCarga + ajuste))
      return { tecnico: t, puntos, motivos, alertas }
    })

  return resultados.sort((a, b) => b.puntos - a.puntos || a.tecnico.nombre.localeCompare(b.tecnico.nombre)).slice(0, cuantos)
}

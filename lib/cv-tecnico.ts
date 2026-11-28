// CV del técnico para licitaciones: experiencia real tomada de sus órdenes
// terminadas, agrupada por contrato (o por cliente si la orden no es de contrato).

import type { Cliente, Equipo, OrdenServicio } from "@/lib/types"

export interface GrupoExperiencia {
  clave: string
  cliente: string
  contrato: string
  objeto: string
  servicios: number
  equipos: string[]
  desde: string
  hasta: string
}

export interface ContratoBreve {
  id: string
  numero: string
  objeto: string
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export function mesAnio(fecha: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(fecha)
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : ""
}

export function experienciaTecnico(
  tecnicoId: string,
  ordenes: OrdenServicio[],
  clientes: Cliente[],
  equipos: Equipo[],
  contratos: ContratoBreve[],
): { grupos: GrupoExperiencia[]; terminadas: number } {
  const terminadas = ordenes.filter((o) => o.tecnicoId === tecnicoId && o.estado === "Terminada")
  const grupos = new Map<string, GrupoExperiencia>()
  for (const o of terminadas) {
    const contrato = o.contratoId ? contratos.find((c) => c.id === o.contratoId) : undefined
    const clave = contrato ? `c:${contrato.id}` : `k:${o.clienteId}`
    const fecha = (o.fechaCierre || o.fechaProgramada || o.fechaSolicitud || "").slice(0, 10)
    const g =
      grupos.get(clave) ??
      ({
        clave,
        cliente: clientes.find((c) => c.id === o.clienteId)?.nombre ?? "",
        contrato: contrato?.numero ?? "",
        objeto: contrato?.objeto ?? "",
        servicios: 0,
        equipos: [],
        desde: fecha,
        hasta: fecha,
      } satisfies GrupoExperiencia)
    g.servicios++
    const eq = equipos.find((e) => e.id === o.equipoId)?.tipo?.trim()
    if (eq && !g.equipos.includes(eq)) g.equipos.push(eq)
    if (fecha && (!g.desde || fecha < g.desde)) g.desde = fecha
    if (fecha && (!g.hasta || fecha > g.hasta)) g.hasta = fecha
    grupos.set(clave, g)
  }
  return {
    grupos: [...grupos.values()].sort((a, b) => b.hasta.localeCompare(a.hasta)),
    terminadas: terminadas.length,
  }
}

export function periodoGrupo(g: { desde: string; hasta: string }): string {
  const a = mesAnio(g.desde)
  const b = mesAnio(g.hasta)
  if (!a && !b) return "—"
  return a === b ? a : `${a} – ${b}`
}

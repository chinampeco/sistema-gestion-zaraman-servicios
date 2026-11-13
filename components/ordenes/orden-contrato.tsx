"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import type { ActividadOrden, OrdenServicio } from "@/lib/types"

interface EquipoDeOrden {
  id: string
  equipoId: string
  realizado: boolean
  observaciones: string
  tipo: string
  marca: string
  modelo: string
  serie: string
  inventario: string
}

// Órdenes generadas desde un contrato: actividades de la ficha técnica (con la
// columna "Operativo") y los equipos que cubre la orden, cada uno con "Realizado".
export function OrdenContrato({ orden, editable }: { orden: OrdenServicio; editable: boolean }) {
  const { actualizarOrden } = useStore()
  const [equipos, setEquipos] = React.useState<EquipoDeOrden[] | null>(null)
  const [actividades, setActividades] = React.useState<ActividadOrden[]>(orden.actividades ?? [])

  React.useEffect(() => setActividades(orden.actividades ?? []), [orden.actividades])

  React.useEffect(() => {
    let vigente = true
    createClient()
      .from("orden_equipos")
      .select("id, equipo_id, realizado, observaciones, equipos(tipo, marca, modelo, numero_serie, numero_inventario)")
      .eq("orden_id", orden.id)
      .order("created_at")
      .then(({ data }) => {
        if (!vigente) return
        setEquipos(
          (data ?? []).map((r: any) => ({
            id: r.id,
            equipoId: r.equipo_id,
            realizado: r.realizado === true,
            observaciones: r.observaciones ?? "",
            tipo: r.equipos?.tipo ?? "Equipo",
            marca: r.equipos?.marca ?? "",
            modelo: r.equipos?.modelo ?? "",
            serie: r.equipos?.numero_serie ?? "",
            inventario: r.equipos?.numero_inventario ?? "",
          })),
        )
      })
    return () => {
      vigente = false
    }
  }, [orden.id])

  if (!orden.contratoId && !orden.referencia && actividades.length === 0) return null

  async function guardarEquipo(e: EquipoDeOrden, cambios: Partial<Pick<EquipoDeOrden, "realizado" | "observaciones">>) {
    const { error } = await createClient()
      .from("orden_equipos")
      .update({
        ...(cambios.realizado !== undefined ? { realizado: cambios.realizado } : {}),
        ...(cambios.observaciones !== undefined ? { observaciones: cambios.observaciones } : {}),
      })
      .eq("id", e.id)
    if (error) {
      toast.error("No se pudo guardar el equipo.")
      return
    }
    setEquipos((prev) => (prev ?? []).map((x) => (x.id === e.id ? { ...x, ...cambios } : x)))
  }

  async function guardarActividades(nuevas: ActividadOrden[]) {
    setActividades(nuevas)
    await actualizarOrden(orden.id, { actividades: nuevas })
  }

  const hechos = (equipos ?? []).filter((e) => e.realizado).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Servicio del contrato
          {orden.referencia ? <Badge variant="outline" className="font-mono">{orden.referencia}</Badge> : null}
        </CardTitle>
        <CardDescription>
          Actividades de la ficha técnica y equipos que cubre esta orden.
          {equipos && equipos.length > 0 ? ` ${hechos} de ${equipos.length} equipo(s) realizados.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {actividades.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Actividades</h3>
            <ol className="flex flex-col divide-y rounded-lg border">
              {actividades.map((a, i) => (
                <li key={a.numero} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
                  <label className="flex flex-1 items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-primary"
                      checked={a.realizada}
                      disabled={!editable}
                      onChange={(ev) =>
                        guardarActividades(actividades.map((x, j) => (j === i ? { ...x, realizada: ev.target.checked } : x)))
                      }
                    />
                    <span>
                      <span className="font-medium">{a.numero}. {a.titulo}</span>
                      {a.detalle.length > 0 && (
                        <ul className="list-[lower-alpha] pl-5 text-muted-foreground">
                          {a.detalle.map((d, k) => <li key={k}>{d}</li>)}
                        </ul>
                      )}
                    </span>
                  </label>
                  <Input
                    aria-label={`Operativo de la actividad ${a.numero}`}
                    placeholder="Operativo / observación"
                    className="sm:w-72"
                    defaultValue={a.operativo}
                    disabled={!editable}
                    onBlur={(ev) => {
                      if (ev.target.value !== a.operativo)
                        guardarActividades(actividades.map((x, j) => (j === i ? { ...x, operativo: ev.target.value } : x)))
                    }}
                  />
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Equipos</h3>
          {equipos === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : equipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin equipos ligados a esta orden.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {equipos.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={e.realizado}
                      disabled={!editable}
                      onChange={(ev) => guardarEquipo(e, { realizado: ev.target.checked })}
                    />
                    <span>
                      <Link href={`/equipos/${e.equipoId}`} className="font-medium text-primary hover:underline">
                        {e.tipo}
                      </Link>{" "}
                      <span className="text-muted-foreground">{[e.marca, e.modelo].filter(Boolean).join(" ")}</span>
                      {(e.inventario || e.serie) && (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {e.inventario ? `S.I.L./Inv. ${e.inventario}` : ""}
                          {e.inventario && e.serie ? " · " : ""}
                          {e.serie ? `Serie ${e.serie}` : ""}
                        </span>
                      )}
                    </span>
                  </label>
                  <Input
                    aria-label={`Observaciones de ${e.tipo}`}
                    placeholder="Observaciones"
                    className="sm:w-72"
                    defaultValue={e.observaciones}
                    disabled={!editable}
                    onBlur={(ev) => {
                      if (ev.target.value !== e.observaciones) guardarEquipo(e, { observaciones: ev.target.value })
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

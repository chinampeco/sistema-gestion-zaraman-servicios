"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { useStore } from "@/lib/store"
import { puedeReasignarOrdenes } from "@/lib/permisos"
import { formatFecha } from "@/lib/format"
import type { HistorialEvento, OrdenServicio } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Sección dentro de Órdenes de servicio con los trabajos aceptados por el
// cliente que todavía no tienen técnico asignado. Solo la ven los roles que
// pueden coordinar (Administrador, Coordinador, Supervisor).
export function PendientesAsignacion() {
  const {
    ordenes,
    cotizaciones,
    clientes,
    equipos,
    tecnicos,
    usuarioActual,
    actualizarOrden,
    actualizarCotizacion,
  } = useStore()

  const [asignando, setAsignando] = React.useState<OrdenServicio | null>(null)
  const [tecnicoId, setTecnicoId] = React.useState<string>("")
  const [guardando, setGuardando] = React.useState(false)

  if (!puedeReasignarOrdenes(usuarioActual.rol)) return null

  const pendientes = ordenes
    .filter((o) => o.estado === "Pendiente de asignación")
    .sort((a, b) => a.folio.localeCompare(b.folio))

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const nombreEquipo = (id: string) => {
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "General"
  }
  const cotizacionDe = (o: OrdenServicio) =>
    cotizaciones.find((c) => c.ordenId === o.id) ?? null

  const tecnicosActivos = tecnicos.filter((t) => t.activo)

  const abrir = (o: OrdenServicio) => {
    setTecnicoId("")
    setAsignando(o)
  }

  const confirmarAsignacion = async () => {
    if (!asignando || !tecnicoId) return
    setGuardando(true)

    const evento: HistorialEvento = {
      estado: "Asignada",
      fecha: new Date().toISOString(),
      usuarioId: usuarioActual.id,
      usuarioNombre: usuarioActual.nombre,
    }
    await actualizarOrden(asignando.id, {
      tecnicoId,
      estado: "Asignada",
      historial: [...asignando.historial, evento],
    })

    // La cotización de origen queda como "Convertida" al asignarse el técnico.
    const cot = cotizacionDe(asignando)
    if (cot) {
      await actualizarCotizacion(cot.id, { estado: "Convertida" })
    }

    const tecnico = tecnicos.find((t) => t.id === tecnicoId)
    toast.success(
      `Orden ${asignando.folio} asignada a ${tecnico?.nombre ?? "el técnico"}.`,
    )
    setGuardando(false)
    setAsignando(null)
  }

  return (
    <>
      <Card className="border-warning/40">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              Pendientes de asignación
              {pendientes.length > 0 && (
                <Badge variant="warning">{pendientes.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Trabajos aceptados por clientes que esperan un técnico responsable.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {pendientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="size-7 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No hay trabajos pendientes de asignación.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {pendientes.map((o) => {
                const cot = cotizacionDe(o)
                return (
                  <li
                    key={o.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/ordenes/${o.id}`}
                          className="font-mono text-sm font-semibold text-primary hover:underline"
                        >
                          {o.folio}
                        </Link>
                        {cot && (
                          <span className="text-xs text-muted-foreground">
                            desde cotización{" "}
                            <span className="font-mono">{cot.folio}</span>
                          </span>
                        )}
                      </div>
                      <span className="truncate text-sm font-medium">
                        {nombreCliente(o.clienteId)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {nombreEquipo(o.equipoId)}
                      </span>
                      {cot?.aceptadaEn && (
                        <span className="text-xs text-muted-foreground">
                          Aceptada el {formatFecha(cot.aceptadaEn.slice(0, 10))}
                        </span>
                      )}
                    </div>
                    <Button size="sm" onClick={() => abrir(o)} className="shrink-0">
                      <UserPlus data-icon="inline-start" />
                      Asignar técnico
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={asignando !== null}
        onOpenChange={(open) => !open && setAsignando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar técnico</DialogTitle>
            <DialogDescription>
              Selecciona al técnico responsable de la orden{" "}
              <span className="font-mono">{asignando?.folio}</span>. Al asignarlo,
              la orden pasará a estado “Asignada” y el técnico recibirá el aviso.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Técnico responsable</label>
            <Select value={tecnicoId} onValueChange={(v) => setTecnicoId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un técnico" />
              </SelectTrigger>
              <SelectContent>
                {tecnicosActivos.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No hay técnicos activos
                  </SelectItem>
                ) : (
                  tecnicosActivos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre} · {t.especialidad || t.rol}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              onClick={confirmarAsignacion}
              disabled={!tecnicoId || guardando}
            >
              Asignar y crear orden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

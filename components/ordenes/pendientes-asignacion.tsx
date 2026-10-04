"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, ShieldCheck, UserPlus } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"

type GarantiaConfig = {
  tieneGarantia: boolean
  duracionValor: number | null
  duracionUnidad: "Días" | "Meses" | "Años"
  cobertura: string
  condiciones: string
  esAtencionGarantia: boolean
  ordenOrigenId: string | null
}

const GARANTIA_DEFAULT: GarantiaConfig = {
  tieneGarantia: false,
  duracionValor: null,
  duracionUnidad: "Meses",
  cobertura: "Mano de obra + materiales",
  condiciones: "",
  esAtencionGarantia: false,
  ordenOrigenId: null,
}

function sumarGarantia(fechaInicio: string, valor: number, unidad: GarantiaConfig["duracionUnidad"]) {
  const fecha = new Date(`${fechaInicio}T00:00:00`)
  if (unidad === "Días") fecha.setDate(fecha.getDate() + valor - 1)
  if (unidad === "Meses") fecha.setMonth(fecha.getMonth() + valor)
  if (unidad === "Años") fecha.setFullYear(fecha.getFullYear() + valor)
  if (unidad !== "Días") fecha.setDate(fecha.getDate() - 1)
  return fecha.toISOString().slice(0, 10)
}

// Trabajos aceptados por el cliente que todavía no tienen técnico asignado.
// La garantía del servicio se define aquí por el supervisor/coordinador/admin,
// no durante la captura técnica.
export function PendientesAsignacion() {
  const {
    ordenes,
    cotizaciones,
    clientes,
    equipos,
    tecnicos,
    usuarioActual,
    asignarOrdenConGarantia,
  } = useStore()
  const supabase = React.useMemo(() => createClient(), [])

  const [asignando, setAsignando] = React.useState<OrdenServicio | null>(null)
  const [tecnicoId, setTecnicoId] = React.useState<string>("")
  const [garantia, setGarantia] = React.useState<GarantiaConfig>(GARANTIA_DEFAULT)
  const [guardando, setGuardando] = React.useState(false)

  if (!puedeReasignarOrdenes(usuarioActual.rol)) return null

  const pendientes = ordenes
    .filter(
      (o) =>
        (o.estado === "Pendiente" || o.estado === "Pendiente de asignación") &&
        !o.tecnicoId,
    )
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

  const abrir = async (o: OrdenServicio) => {
    setTecnicoId("")
    setGarantia(GARANTIA_DEFAULT)
    setAsignando(o)

    const { data, error } = await supabase
      .from("orden_garantias")
      .select("tiene_garantia, duracion_valor, duracion_unidad, cobertura, condiciones, orden_origen_id")
      .eq("orden_id", o.id)
      .maybeSingle()

    if (error) {
      console.warn("No se pudo cargar la garantía de la orden:", error.message)
      return
    }

    if (data) {
      setGarantia({
        tieneGarantia: Boolean(data.tiene_garantia),
        duracionValor: data.duracion_valor == null ? null : Number(data.duracion_valor),
        duracionUnidad: (data.duracion_unidad ?? "Meses") as GarantiaConfig["duracionUnidad"],
        cobertura: data.cobertura ?? GARANTIA_DEFAULT.cobertura,
        condiciones: data.condiciones ?? "",
        esAtencionGarantia: Boolean(data.orden_origen_id),
        ordenOrigenId: data.orden_origen_id ?? null,
      })
    }
  }

  const confirmarAsignacion = async () => {
    if (!asignando || !tecnicoId || guardando) return

    if (!garantia.esAtencionGarantia && garantia.tieneGarantia) {
      if (!garantia.duracionValor || garantia.duracionValor <= 0) {
        toast.error("Indica una duración válida para la garantía.")
        return
      }
    }

    setGuardando(true)

    const evento: HistorialEvento = {
      estado: "Asignada",
      fecha: new Date().toISOString(),
      usuarioId: usuarioActual.id,
      usuarioNombre: usuarioActual.nombre,
    }

    try {
      const actualizada = await asignarOrdenConGarantia(
        asignando.id,
        tecnicoId,
        [...asignando.historial, evento],
        {
          ordenOrigenId: garantia.ordenOrigenId,
          tieneGarantia: garantia.tieneGarantia,
          duracionValor: garantia.duracionValor,
          duracionUnidad: garantia.duracionUnidad,
          cobertura: garantia.cobertura,
          condiciones: garantia.condiciones,
          resultado: garantia.esAtencionGarantia ? "Aprobada" : "Pendiente",
        },
      )

      if (!actualizada) return

      const tecnico = tecnicos.find((t) => t.id === tecnicoId)
      toast.success(
        `Orden ${asignando.folio} asignada a ${tecnico?.nombre ?? "el técnico"} con garantía guardada.`,
      )
      setAsignando(null)
      setTecnicoId("")
      setGarantia(GARANTIA_DEFAULT)
    } catch {
      toast.error("No se pudo asignar el técnico ni guardar la garantía. Intenta nuevamente.")
    } finally {
      setGuardando(false)
    }
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
                            desde cotización <span className="font-mono">{cot.folio}</span>
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
                    <Button size="sm" onClick={() => void abrir(o)} className="shrink-0">
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
        onOpenChange={(open) => {
          if (!open) {
            setAsignando(null)
            setTecnicoId("")
            setGarantia(GARANTIA_DEFAULT)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Asignar técnico</DialogTitle>
            <DialogDescription>
              Selecciona al técnico responsable de la orden{" "}
              <span className="font-mono">{asignando?.folio}</span> y define la garantía
              que ZARAMAN otorgará al servicio.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel>Técnico responsable</FieldLabel>
              <Select value={tecnicoId} onValueChange={(v) => setTecnicoId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un técnico">
                    {(value) => {
                      const tecnico = tecnicos.find((t) => t.id === value)
                      return tecnico
                        ? tecnico.nombre
                        : "Selecciona un técnico"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {tecnicosActivos.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No hay técnicos activos
                    </SelectItem>
                  ) : (
                    tecnicosActivos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3 flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 text-primary" />
                <div>
                  <div className="font-medium">Garantía del servicio</div>
                  {garantia.esAtencionGarantia ? (
                    <p className="text-xs text-muted-foreground">
                      Esta orden ya corresponde a una atención por garantía. La garantía original no se modifica.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      La garantía comienza únicamente cuando el servicio quede terminado y firmado.
                    </p>
                  )}
                </div>
              </div>

              {garantia.esAtencionGarantia ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="font-medium">Atención por garantía</div>
                  <div className="mt-1 text-muted-foreground">
                    Orden origen: <span className="font-mono">{garantia.ordenOrigenId}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">Sin nueva vigencia comercial.</div>
                </div>
              ) : (
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <Input
                      id="asignacion-tiene-garantia"
                      type="checkbox"
                      className="size-4"
                      checked={garantia.tieneGarantia}
                      onChange={(e) => setGarantia((prev) => ({ ...prev, tieneGarantia: e.target.checked }))}
                    />
                    Este servicio tiene garantía
                  </label>

                  {garantia.tieneGarantia ? (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="asignacion-garantia-duracion">Duración</FieldLabel>
                        <Input
                          id="asignacion-garantia-duracion"
                          type="number"
                          min={1}
                          step={1}
                          value={garantia.duracionValor ?? ""}
                          onChange={(e) =>
                            setGarantia((prev) => ({
                              ...prev,
                              duracionValor: e.target.value === "" ? null : Number(e.target.value),
                            }))
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Unidad</FieldLabel>
                        <Select
                          value={garantia.duracionUnidad}
                          onValueChange={(v) =>
                            setGarantia((prev) => ({
                              ...prev,
                              duracionUnidad: v as GarantiaConfig["duracionUnidad"],
                            }))
                          }
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Días">Días</SelectItem>
                            <SelectItem value="Meses">Meses</SelectItem>
                            <SelectItem value="Años">Años</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel>Cobertura</FieldLabel>
                        <Select
                          value={garantia.cobertura}
                          onValueChange={(v) => setGarantia((prev) => ({ ...prev, cobertura: v }))}
                        >
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mano de obra">Mano de obra</SelectItem>
                            <SelectItem value="Materiales">Materiales</SelectItem>
                            <SelectItem value="Mano de obra + materiales">Mano de obra + materiales</SelectItem>
                            <SelectItem value="Personalizada">Personalizada</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel htmlFor="asignacion-garantia-condiciones">Condiciones</FieldLabel>
                        <Textarea
                          id="asignacion-garantia-condiciones"
                          value={garantia.condiciones}
                          onChange={(e) => setGarantia((prev) => ({ ...prev, condiciones: e.target.value }))}
                          placeholder="Condiciones, exclusiones o notas de cobertura."
                          rows={3}
                        />
                      </Field>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Esta orden quedará registrada como “Sin garantía”.</p>
                  )}
                </>
              )}
            </div>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              onClick={confirmarAsignacion}
              disabled={!tecnicoId || guardando}
            >
              {guardando ? "Guardando…" : "Asignar técnico y guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

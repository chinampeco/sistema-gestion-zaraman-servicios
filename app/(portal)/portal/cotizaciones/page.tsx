"use client"

import * as React from "react"
import { Check, ChevronDown, ClipboardList, FileText, X } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EstadoCotizacionBadge } from "@/components/status-badges"
import { formatFecha, formatMoneda } from "@/lib/format"
import type { Cotizacion } from "@/lib/types"

type Pendiente = { cotizacion: Cotizacion; accion: "aceptar" | "rechazar" }

export default function PortalCotizacionesPage() {
  const { cotizaciones, ordenes, equipos, cargando, recargar } = useStore()
  const [procesando, setProcesando] = React.useState<string | null>(null)
  const [abierta, setAbierta] = React.useState<string | null>(null)
  const [pendiente, setPendiente] = React.useState<Pendiente | null>(null)
  const [motivo, setMotivo] = React.useState("")
  // Cotizaciones que ya marcamos como vistas en esta sesión (evita repetir).
  const vistasRef = React.useRef<Set<string>>(new Set())

  const lista = [...cotizaciones].sort((a, b) => b.folio.localeCompare(a.folio))

  const equipoTexto = (c: Cotizacion) => {
    const e = equipos.find((eq) => eq.id === c.equipoId)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}` : "General"
  }

  const folioOrden = (c: Cotizacion) =>
    c.ordenId ? ordenes.find((o) => o.id === c.ordenId)?.folio ?? null : null

  const enviarAccion = React.useCallback(
    async (
      cotizacionId: string,
      accion: "marcar-vista" | "aceptar" | "rechazar",
      motivoRechazo?: string,
    ) => {
      const res = await fetch("/api/portal/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizacionId, accion, motivoRechazo }),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, data }
    },
    [],
  )

  // Al abrir una cotización "Enviada" por primera vez, registrarla como vista.
  const alternar = async (c: Cotizacion) => {
    const expandir = abierta !== c.id
    setAbierta(expandir ? c.id : null)
    if (expandir && c.estado === "Enviada" && !vistasRef.current.has(c.id)) {
      vistasRef.current.add(c.id)
      const { ok } = await enviarAccion(c.id, "marcar-vista")
      if (ok) await recargar()
    }
  }

  const confirmar = async () => {
    if (!pendiente) return
    const { cotizacion, accion } = pendiente
    const motivoRechazo = accion === "rechazar" ? motivo.trim() : undefined
    setPendiente(null)
    setMotivo("")
    setProcesando(cotizacion.id)
    const { ok, data } = await enviarAccion(cotizacion.id, accion, motivoRechazo)
    setProcesando(null)
    if (!ok) {
      toast.error(data?.error ?? "No se pudo procesar la solicitud.")
      return
    }
    if (accion === "aceptar") {
      toast.success(
        data?.ordenFolio
          ? `Cotización aceptada. Se generó la orden ${data.ordenFolio}.`
          : "Cotización aceptada.",
      )
    } else {
      toast.success("Cotización rechazada.")
    }
    await recargar()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis cotizaciones</h1>
        <p className="text-sm text-muted-foreground">
          Revisa los presupuestos enviados y acéptalos o recházalos.
        </p>
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {cargando ? "Cargando…" : "Aún no tienes cotizaciones."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((c) => {
            const puedeResponder = c.estado === "Enviada" || c.estado === "Vista"
            const expandida = abierta === c.id
            const orden = folioOrden(c)
            return (
              <Card key={c.id}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => alternar(c)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left"
                    aria-expanded={expandida}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm font-medium">{c.folio}</span>
                      <span className="text-xs text-muted-foreground">
                        {equipoTexto(c)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoneda(c.total)}
                      </span>
                      <EstadoCotizacionBadge estado={c.estado} />
                      <ChevronDown
                        className={cn(
                          "size-4 text-muted-foreground transition-transform",
                          expandida && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {expandida && (
                    <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
                      {orden && (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
                          <ClipboardList className="size-4 text-muted-foreground" />
                          <span>
                            Orden de servicio generada:{" "}
                            <span className="font-mono font-medium">{orden}</span>
                          </span>
                        </div>
                      )}

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                              <TableHead className="text-right">Precio</TableHead>
                              <TableHead className="text-right">Importe</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {c.conceptos.map((con, i) => {
                              const bruto = con.cantidad * con.precioUnitario
                              const importe = Math.max(
                                0,
                                bruto - bruto * (con.descuento / 100),
                              )
                              return (
                                <TableRow key={i}>
                                  <TableCell className="font-medium">
                                    {con.descripcion}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {con.cantidad}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatMoneda(con.precioUnitario)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium tabular-nums">
                                    {formatMoneda(importe)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="tabular-nums">{formatMoneda(c.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Descuento</span>
                          <span className="tabular-nums">-{formatMoneda(c.descuento)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">IVA</span>
                          <span className="tabular-nums">{formatMoneda(c.iva)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums">{formatMoneda(c.total)}</span>
                        </div>
                      </div>

                      {c.condiciones && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Condiciones
                          </span>
                          <p className="text-sm leading-relaxed text-pretty">
                            {c.condiciones}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          {c.vigencia
                            ? `Vigente hasta ${formatFecha(c.vigencia)}`
                            : "Sin fecha de vigencia"}
                        </span>
                        {puedeResponder && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={procesando === c.id}
                              onClick={() => setPendiente({ cotizacion: c, accion: "rechazar" })}
                              className="text-destructive hover:text-destructive"
                            >
                              <X data-icon="inline-start" />
                              Rechazar
                            </Button>
                            <Button
                              size="sm"
                              disabled={procesando === c.id}
                              onClick={() => setPendiente({ cotizacion: c, accion: "aceptar" })}
                            >
                              <Check data-icon="inline-start" />
                              Aceptar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <AlertDialog
        open={pendiente !== null}
        onOpenChange={(open) => !open && setPendiente(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendiente?.accion === "aceptar"
                ? "¿Aceptar esta cotización?"
                : "¿Rechazar esta cotización?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendiente?.accion === "aceptar" ? (
                <>
                  Al aceptar la cotización{" "}
                  <strong>{pendiente?.cotizacion.folio}</strong> se autorizará el
                  trabajo y se generará una orden de servicio pendiente de asignación.
                  Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  Vas a rechazar la cotización{" "}
                  <strong>{pendiente?.cotizacion.folio}</strong>. Esta acción no se
                  puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendiente?.accion === "rechazar" && (
            <Field>
              <FieldLabel htmlFor="motivo-rechazo">
                Motivo del rechazo (opcional)
              </FieldLabel>
              <Textarea
                id="motivo-rechazo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                placeholder="Cuéntanos por qué rechazas esta cotización para poder mejorar la propuesta…"
              />
            </Field>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmar}
              className={cn(
                pendiente?.accion === "rechazar" &&
                  "bg-destructive text-white hover:bg-destructive/90",
              )}
            >
              {pendiente?.accion === "aceptar" ? "Aceptar cotización" : "Rechazar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

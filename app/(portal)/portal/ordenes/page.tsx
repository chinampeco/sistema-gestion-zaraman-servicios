"use client"

import * as React from "react"
import { ClipboardList } from "lucide-react"

import { useStore } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EstadoOrdenBadge, PrioridadBadge } from "@/components/status-badges"
import { formatFecha } from "@/lib/format"
import type { OrdenServicio } from "@/lib/types"

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{valor || "—"}</span>
    </div>
  )
}

export default function PortalOrdenesPage() {
  const { ordenes, equipos, tecnicos, cargando } = useStore()
  const [sel, setSel] = React.useState<OrdenServicio | null>(null)

  const lista = [...ordenes].sort((a, b) => (b.fechaSolicitud ?? "").localeCompare(a.fechaSolicitud ?? ""))

  const equipoDe = (o: OrdenServicio) => equipos.find((e) => e.id === o.equipoId)
  const equipoTexto = (o: OrdenServicio) => {
    const e = equipoDe(o)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}` : "—"
  }
  const tecnicoTexto = (o: OrdenServicio) => tecnicos.find((t) => t.id === o.tecnicoId)?.nombre ?? "Por asignar"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis órdenes de servicio</h1>
        <p className="text-sm text-muted-foreground">Consulta el estado y detalle de tus servicios.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead className="hidden sm:table-cell">Equipo</TableHead>
                <TableHead className="hidden md:table-cell">Técnico</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {cargando ? "Cargando…" : "Aún no tienes órdenes registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.folio}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{equipoTexto(o)}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{equipoTexto(o)}</TableCell>
                    <TableCell className="hidden md:table-cell">{tecnicoTexto(o)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatFecha(o.fechaSolicitud)}</TableCell>
                    <TableCell>
                      <EstadoOrdenBadge estado={o.estado} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSel(o)}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={sel !== null} onOpenChange={(open) => !open && setSel(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="size-5 text-muted-foreground" />
                  {sel.folio}
                </DialogTitle>
                <DialogDescription>Detalle de la orden de servicio.</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <EstadoOrdenBadge estado={sel.estado} />
                  <PrioridadBadge prioridad={sel.prioridad} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Dato label="Equipo" valor={equipoTexto(sel)} />
                  <Dato label="Técnico" valor={tecnicoTexto(sel)} />
                  <Dato label="Tipo de servicio" valor={sel.tipoServicio} />
                  <Dato label="Fecha de solicitud" valor={formatFecha(sel.fechaSolicitud)} />
                  <Dato label="Fecha programada" valor={formatFecha(sel.fechaProgramada)} />
                  <Dato label="Fecha de cierre" valor={formatFecha(sel.fechaCierre)} />
                </div>

                <Dato label="Descripción / motivo" valor={sel.descripcionFalla} />
                <Dato label="Diagnóstico" valor={sel.diagnostico} />
                <Dato label="Trabajo realizado" valor={sel.trabajoRealizado} />

                {sel.materialesDetalle && sel.materialesDetalle.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Materiales / refacciones
                    </span>
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sel.materialesDetalle.map((m, i) => (
                            <TableRow key={i}>
                              <TableCell>{m.descripcion}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {m.cantidad}
                                {m.unidad ? ` ${m.unidad}` : ""}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <Dato label="Materiales / refacciones" valor={sel.materiales} />
                )}

                {sel.evidencias && sel.evidencias.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Evidencias fotográficas
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {sel.evidencias.map((ev, i) => (
                        <a
                          key={i}
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square overflow-hidden rounded-md border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.url || "/placeholder.svg"}
                            alt={ev.descripcion || `Evidencia ${i + 1}`}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <Dato label="Observaciones" valor={sel.observaciones} />

                {sel.firmaCliente && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Firma de conformidad
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sel.firmaCliente || "/placeholder.svg"}
                      alt="Firma del cliente"
                      className="h-24 w-auto rounded-md border bg-white object-contain"
                    />
                    {sel.firmaFecha && (
                      <span className="text-xs text-muted-foreground">
                        Firmada el {formatFecha(sel.firmaFecha)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

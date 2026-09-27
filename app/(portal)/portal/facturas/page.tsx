"use client"

import * as React from "react"
import { ChevronDown, Receipt } from "lucide-react"

import { cn } from "@/lib/utils"
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
import { EstadoFacturaBadge } from "@/components/status-badges"
import { formatFecha, formatMoneda } from "@/lib/format"
import type { Factura } from "@/lib/types"

export default function PortalFacturasPage() {
  const { facturas, pagos, cargando } = useStore()
  const [abierta, setAbierta] = React.useState<string | null>(null)

  const lista = [...facturas].sort((a, b) => b.folio.localeCompare(a.folio))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis facturas</h1>
        <p className="text-sm text-muted-foreground">
          Consulta tus facturas, importes y saldos pendientes.
        </p>
      </div>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Receipt className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {cargando ? "Cargando…" : "Aún no tienes facturas."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {lista.map((f) => {
            const expandida = abierta === f.id
            const pagosFactura = pagos.filter((p) => p.facturaId === f.id)
            return (
              <Card key={f.id}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => setAbierta(expandida ? null : f.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left"
                    aria-expanded={expandida}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-sm font-medium">{f.folio}</span>
                      <span className="text-xs text-muted-foreground">
                        {f.fechaEmision
                          ? `Emitida ${formatFecha(f.fechaEmision)}`
                          : "Sin fecha de emisión"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoneda(f.total)}
                        </span>
                        {f.saldo > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            Saldo {formatMoneda(f.saldo)}
                          </span>
                        )}
                      </div>
                      <EstadoFacturaBadge estado={f.estado} />
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
                            {f.conceptos.map((con, i) => {
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
                          <span className="tabular-nums">{formatMoneda(f.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Descuento</span>
                          <span className="tabular-nums">-{formatMoneda(f.descuento)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">IVA</span>
                          <span className="tabular-nums">{formatMoneda(f.iva)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
                          <span>Total</span>
                          <span className="tabular-nums">{formatMoneda(f.total)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Pagado</span>
                          <span className="tabular-nums">{formatMoneda(f.montoPagado)}</span>
                        </div>
                        <div className="flex items-center justify-between font-semibold">
                          <span>Saldo</span>
                          <span className="tabular-nums">{formatMoneda(f.saldo)}</span>
                        </div>
                      </div>

                      {pagosFactura.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Pagos registrados
                          </span>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Folio</TableHead>
                                  <TableHead>Fecha</TableHead>
                                  <TableHead>Método</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pagosFactura.map((p) => (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-mono">{p.folio}</TableCell>
                                    <TableCell>
                                      {p.fechaPago ? formatFecha(p.fechaPago) : "—"}
                                    </TableCell>
                                    <TableCell>{p.metodo}</TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                      {formatMoneda(p.monto)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {f.condiciones && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Condiciones
                          </span>
                          <p className="text-sm leading-relaxed text-pretty">
                            {f.condiciones}
                          </p>
                        </div>
                      )}

                      {f.fechaVencimiento && (
                        <span className="text-xs text-muted-foreground">
                          Vence {formatFecha(f.fechaVencimiento)}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

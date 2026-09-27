"use client"

import * as React from "react"
import Link from "next/link"
import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EstadoFacturaBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha, formatMoneda } from "@/lib/format"

export default function CobranzaPage() {
  const { facturas, pagos, clientes } = useStore()

  const nombreCliente = React.useCallback(
    (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—",
    [clientes],
  )

  const hoy = new Date().toISOString().slice(0, 10)

  const porCobrar = React.useMemo(
    () =>
      facturas
        .filter((f) => f.estado !== "Cancelada" && f.saldo > 0)
        .sort((a, b) => {
          const av = a.fechaVencimiento ?? "9999-12-31"
          const bv = b.fechaVencimiento ?? "9999-12-31"
          return av.localeCompare(bv)
        }),
    [facturas],
  )

  const totalPorCobrar = porCobrar.reduce((acc, f) => acc + f.saldo, 0)
  const vencidas = porCobrar.filter(
    (f) => f.fechaVencimiento && f.fechaVencimiento < hoy,
  )
  const totalVencido = vencidas.reduce((acc, f) => acc + f.saldo, 0)
  const cobradoMes = React.useMemo(() => {
    const mes = hoy.slice(0, 7)
    return pagos
      .filter((p) => (p.fechaPago ?? "").slice(0, 7) === mes)
      .reduce((acc, p) => acc + p.monto, 0)
  }, [pagos, hoy])

  const pagosRecientes = React.useMemo(
    () =>
      [...pagos]
        .sort((a, b) => (b.fechaPago ?? "").localeCompare(a.fechaPago ?? ""))
        .slice(0, 10),
    [pagos],
  )

  return (
    <>
      <PageHeader
        title="Cobranza"
        description="Saldos pendientes, vencimientos y pagos recibidos."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Por cobrar"
          value={formatMoneda(totalPorCobrar)}
          icon={Wallet}
          hint={`${porCobrar.length} factura(s) con saldo`}
        />
        <StatCard
          label="Vencido"
          value={formatMoneda(totalVencido)}
          icon={AlertTriangle}
          accent="destructive"
          hint={`${vencidas.length} factura(s) vencida(s)`}
        />
        <StatCard
          label="Cobrado este mes"
          value={formatMoneda(cobradoMes)}
          icon={CheckCircle2}
          accent="success"
          hint="Pagos recibidos en el mes en curso"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facturas por cobrar</CardTitle>
        </CardHeader>
        <CardContent>
          {porCobrar.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckCircle2 />
                </EmptyMedia>
                <EmptyTitle>Sin saldos pendientes</EmptyTitle>
                <EmptyDescription>
                  Todas las facturas emitidas están pagadas.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Total
                    </TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="hidden md:table-cell">Vence</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCobrar.map((f) => {
                    const vencida = f.fechaVencimiento && f.fechaVencimiento < hoy
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono font-medium">
                          {f.folio}
                        </TableCell>
                        <TableCell>{nombreCliente(f.clienteId)}</TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatMoneda(f.total)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoneda(f.saldo)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {f.fechaVencimiento ? (
                            <span className={vencida ? "text-destructive" : undefined}>
                              {formatFecha(f.fechaVencimiento)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <EstadoFacturaBadge estado={f.estado} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/facturas/${f.id}`} />}
                            nativeButton={false}
                          >
                            Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {pagosRecientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no se han registrado pagos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead className="hidden md:table-cell">Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosRecientes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.folio}</TableCell>
                      <TableCell>{nombreCliente(p.clienteId)}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.fechaPago ? formatFecha(p.fechaPago) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{p.metodo}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoneda(p.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

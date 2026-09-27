"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Printer, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { FacturaFormDialog } from "@/components/facturas/factura-form-dialog"
import { EstadoFacturaBadge } from "@/components/status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Dialog,
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
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha, formatMoneda } from "@/lib/format"
import { METODOS_PAGO, type MetodoPago } from "@/lib/types"

export default function FacturaDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    facturas,
    pagos,
    ordenes,
    cotizaciones,
    clientes,
    usuarios,
    registrarPago,
    eliminarPago,
  } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)
  const [pagoOpen, setPagoOpen] = React.useState(false)

  const factura = facturas.find((f) => f.id === params.id)

  if (!factura) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Factura no encontrada</EmptyTitle>
          <EmptyDescription>
            La factura que buscas no existe o fue eliminada.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/facturas")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a facturación
        </Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === factura.clienteId)
  const creador = usuarios.find((u) => u.id === factura.creadoPor)
  const orden = ordenes.find((o) => o.id === factura.ordenId)
  const cotizacion = cotizaciones.find((c) => c.id === factura.cotizacionId)
  const pagosFactura = pagos.filter((p) => p.facturaId === factura.id)

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/facturas" />}
          nativeButton={false}
          aria-label="Volver"
        >
          <ArrowLeft />
        </Button>
        <PageHeader
          title={factura.folio}
          description={cliente?.nombre}
          actions={
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer data-icon="inline-start" />
                Imprimir / PDF
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
              {factura.estado !== "Cancelada" && factura.saldo > 0 && (
                <Button onClick={() => setPagoOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Registrar pago
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EstadoFacturaBadge estado={factura.estado} />
        {factura.fechaVencimiento && (
          <Badge variant="outline">
            Vence {formatFecha(factura.fechaVencimiento)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Conceptos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      Desc.
                    </TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factura.conceptos.map((c, i) => {
                    const bruto = c.cantidad * c.precioUnitario
                    const importe = Math.max(0, bruto - bruto * (c.descuento / 100))
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {c.descripcion}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {c.tipo}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.cantidad}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneda(c.precioUnitario)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {c.descuento}%
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
                <span className="tabular-nums">{formatMoneda(factura.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span className="tabular-nums">-{formatMoneda(factura.descuento)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{formatMoneda(factura.iva)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoneda(factura.total)}</span>
              </div>
              <div className="flex items-center justify-between text-primary">
                <span>Pagado</span>
                <span className="tabular-nums">{formatMoneda(factura.montoPagado)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold">
                <span>Saldo</span>
                <span className="tabular-nums">{formatMoneda(factura.saldo)}</span>
              </div>
            </div>

            {(factura.condiciones || factura.observaciones) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Bloque label="Condiciones" value={factura.condiciones} />
                  <Bloque label="Observaciones" value={factura.observaciones} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Referencias</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Cliente">
                {cliente ? (
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="text-primary hover:underline"
                  >
                    {cliente.nombre}
                  </Link>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato label="Orden">
                {orden ? (
                  <Link
                    href={`/ordenes/${orden.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {orden.folio}
                  </Link>
                ) : (
                  "Sin orden"
                )}
              </Dato>
              <Dato label="Cotización">
                {cotizacion ? (
                  <Link
                    href={`/cotizaciones/${cotizacion.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {cotizacion.folio}
                  </Link>
                ) : (
                  "Sin cotización"
                )}
              </Dato>
              <Dato label="Registrado por">{creador?.nombre ?? "—"}</Dato>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fechas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Emisión">
                {factura.fechaEmision ? formatFecha(factura.fechaEmision) : "—"}
              </Dato>
              <Dato label="Vencimiento">
                {factura.fechaVencimiento
                  ? formatFecha(factura.fechaVencimiento)
                  : "—"}
              </Dato>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {pagosFactura.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no se han registrado pagos para esta factura.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="hidden sm:table-cell">Referencia</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right print:hidden">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosFactura.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.folio}</TableCell>
                      <TableCell>{p.fechaPago ? formatFecha(p.fechaPago) : "—"}</TableCell>
                      <TableCell>{p.metodo}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {p.referencia || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoneda(p.monto)}
                      </TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => eliminarPago(p.id)}
                          aria-label="Eliminar pago"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FacturaFormDialog open={editOpen} onOpenChange={setEditOpen} factura={factura} />
      <PagoDialog
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        saldo={factura.saldo}
        onSubmit={async (monto, metodo, referencia, fechaPago, observaciones) => {
          if (monto <= 0) {
            toast.error("El monto debe ser mayor a cero.")
            return
          }
          await registrarPago({
            facturaId: factura.id,
            clienteId: factura.clienteId,
            monto,
            metodo,
            referencia,
            fechaPago,
            observaciones,
            creadoPor: creador?.id ?? "",
          })
          setPagoOpen(false)
        }}
      />
    </>
  )
}

function PagoDialog({
  open,
  onOpenChange,
  saldo,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  saldo: number
  onSubmit: (
    monto: number,
    metodo: MetodoPago,
    referencia: string,
    fechaPago: string,
    observaciones: string,
  ) => void | Promise<void>
}) {
  const [monto, setMonto] = React.useState("")
  const [metodo, setMetodo] = React.useState<MetodoPago>("Transferencia")
  const [referencia, setReferencia] = React.useState("")
  const [fechaPago, setFechaPago] = React.useState(
    new Date().toISOString().slice(0, 10),
  )
  const [observaciones, setObservaciones] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setMonto(saldo > 0 ? String(saldo) : "")
      setMetodo("Transferencia")
      setReferencia("")
      setFechaPago(new Date().toISOString().slice(0, 10))
      setObservaciones("")
    }
  }, [open, saldo])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(Number(monto) || 0, metodo, referencia, fechaPago, observaciones)
          }}
        >
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
            <DialogDescription>
              Saldo pendiente: {formatMoneda(saldo)}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="monto">Monto</FieldLabel>
                <Input
                  id="monto"
                  type="number"
                  min={0}
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fechaPago">Fecha</FieldLabel>
                <Input
                  id="fechaPago"
                  type="date"
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Select value={metodo} onValueChange={(v) => setMetodo(v as MetodoPago)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="referencia">Referencia</FieldLabel>
              <Input
                id="referencia"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Folio de transferencia, cheque, etc."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="obs">Observaciones</FieldLabel>
              <Input
                id="obs"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Registrar pago</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Bloque({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="text-sm leading-relaxed text-pretty">{value || "—"}</p>
    </div>
  )
}

function Dato({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

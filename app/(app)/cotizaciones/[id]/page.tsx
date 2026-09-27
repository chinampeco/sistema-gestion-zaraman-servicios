"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, ClipboardList, Printer } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog"
import { EstadoCotizacionBadge } from "@/components/status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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

export default function CotizacionDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    cotizaciones,
    ordenes,
    clientes,
    equipos,
    usuarios,
    convertirCotizacionEnOrden,
  } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)
  const [generando, setGenerando] = React.useState(false)

  const cotizacion = cotizaciones.find((c) => c.id === params.id)

  if (!cotizacion) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Cotización no encontrada</EmptyTitle>
          <EmptyDescription>
            La cotización que buscas no existe o fue eliminada.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/cotizaciones")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a cotizaciones
        </Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === cotizacion.clienteId)
  const equipo = equipos.find((e) => e.id === cotizacion.equipoId)
  const creador = usuarios.find((u) => u.id === cotizacion.creadoPor)
  const orden = ordenes.find((o) => o.id === cotizacion.ordenId)

  const handleGenerarOrden = async () => {
    setGenerando(true)
    const nueva = await convertirCotizacionEnOrden(cotizacion)
    setGenerando(false)
    if (nueva) router.push(`/ordenes/${nueva.id}`)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/cotizaciones" />}
          nativeButton={false}
          aria-label="Volver"
        >
          <ArrowLeft />
        </Button>
        <PageHeader
          title={cotizacion.folio}
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
              {!cotizacion.ordenId && (
                <Button onClick={handleGenerarOrden} disabled={generando}>
                  <ClipboardList data-icon="inline-start" />
                  {generando ? "Generando…" : "Generar orden"}
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EstadoCotizacionBadge estado={cotizacion.estado} />
        {cotizacion.vigencia && (
          <Badge variant="outline">
            Vigente hasta {formatFecha(cotizacion.vigencia)}
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
                  {cotizacion.conceptos.map((c, i) => {
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
                <span className="tabular-nums">
                  {formatMoneda(cotizacion.subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span className="tabular-nums">
                  -{formatMoneda(cotizacion.descuento)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{formatMoneda(cotizacion.iva)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatMoneda(cotizacion.total)}
                </span>
              </div>
            </div>

            {(cotizacion.condiciones || cotizacion.observaciones) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Bloque label="Condiciones" value={cotizacion.condiciones} />
                  <Bloque label="Observaciones" value={cotizacion.observaciones} />
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
              <Dato label="Contacto">{cotizacion.contacto || "—"}</Dato>
              <Dato label="Equipo">
                {equipo ? (
                  <Link
                    href={`/equipos/${equipo.id}`}
                    className="text-primary hover:underline"
                  >
                    {equipo.tipo} · {equipo.marca} {equipo.modelo}
                  </Link>
                ) : (
                  "Sin equipo específico"
                )}
              </Dato>
              <Dato label="Orden generada">
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
              <Dato label="Registrado por">{creador?.nombre ?? "—"}</Dato>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fechas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Emisión">{formatFecha(cotizacion.createdAt)}</Dato>
              <Dato label="Vigencia">
                {cotizacion.vigencia ? formatFecha(cotizacion.vigencia) : "—"}
              </Dato>
            </CardContent>
          </Card>
        </div>
      </div>

      <CotizacionFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cotizacion={cotizacion}
      />
    </>
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

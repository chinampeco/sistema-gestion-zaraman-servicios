"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Eye, Pencil, FileText, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { EstadoCotizacionBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha, formatMoneda } from "@/lib/format"
import { ESTADOS_COTIZACION, type Cotizacion } from "@/lib/types"

export default function CotizacionesPage() {
  const { cotizaciones, clientes, eliminarCotizacion } = useStore()
  const [query, setQuery] = React.useState("")
  const [estadoFiltro, setEstadoFiltro] = React.useState<string>("todos")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Cotizacion | null>(null)
  const [deleting, setDeleting] = React.useState<Cotizacion | null>(null)

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"

  const filtradas = cotizaciones
    .filter((c) => {
      const q = query.toLowerCase()
      const coincide =
        c.folio.toLowerCase().includes(q) ||
        nombreCliente(c.clienteId).toLowerCase().includes(q)
      const coincideEstado = estadoFiltro === "todos" || c.estado === estadoFiltro
      return coincide && coincideEstado
    })
    .sort((a, b) => b.folio.localeCompare(a.folio))

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (cotizacion: Cotizacion) => {
    setEditing(cotizacion)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Cotizaciones"
        description="Presupuestos de servicio y refacciones para tus clientes."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nueva cotización
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio o cliente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={estadoFiltro} onValueChange={(v) => setEstadoFiltro(v as string)}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_COTIZACION.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtradas.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle>Sin cotizaciones</EmptyTitle>
                <EmptyDescription>
                  No se encontraron cotizaciones con ese criterio.
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
                    <TableHead className="hidden sm:table-cell">Vigencia</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/cotizaciones/${c.id}`}
                          className="font-mono text-sm font-medium text-primary hover:underline"
                        >
                          {c.folio}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {c.conceptos.length}{" "}
                          {c.conceptos.length === 1 ? "concepto" : "conceptos"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">
                        {nombreCliente(c.clienteId)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {c.vigencia ? formatFecha(c.vigencia) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoneda(c.total)}
                      </TableCell>
                      <TableCell>
                        <EstadoCotizacionBadge estado={c.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/cotizaciones/${c.id}`} />}
                            nativeButton={false}
                            aria-label="Ver cotización"
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditar(c)}
                            aria-label="Editar cotización"
                          >
                            <Pencil />
                          </Button>
                         {c.estado === "Enviada" && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDelete(c)}
                              aria-label="Eliminar cotización"
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CotizacionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cotizacion={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar cotización?"
        description={
          <>
            Se eliminará la cotización <strong>{deleting?.folio}</strong>. Esta
            acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarCotizacion(deleting.id)
        }}
      />
    </>
  )
}

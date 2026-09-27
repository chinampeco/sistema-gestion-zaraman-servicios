"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Eye, Pencil, ClipboardList, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { OrdenFormDialog } from "@/components/ordenes/orden-form-dialog"
import { AccionesRapidasTecnico } from "@/components/ordenes/acciones-rapidas-tecnico"
import { PendientesAsignacion } from "@/components/ordenes/pendientes-asignacion"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { EstadoOrdenBadge } from "@/components/status-badges"
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
import { formatFecha } from "@/lib/format"
import { ESTADOS_ORDEN, type OrdenServicio } from "@/lib/types"

export default function OrdenesPage() {
  const { ordenes, clientes, equipos, tecnicos, eliminarOrden } = useStore()
  const [query, setQuery] = React.useState("")
  const [estadoFiltro, setEstadoFiltro] = React.useState<string>("todos")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OrdenServicio | null>(null)
  const [deleting, setDeleting] = React.useState<OrdenServicio | null>(null)

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const nombreEquipo = (id: string) => {
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "—"
  }
  const nombreTecnico = (id: string | null) =>
    tecnicos.find((t) => t.id === id)?.nombre ?? "Sin asignar"

  const filtradas = ordenes
    .filter((o) => {
      const q = query.toLowerCase()
      const coincide =
        o.folio.toLowerCase().includes(q) ||
        nombreCliente(o.clienteId).toLowerCase().includes(q) ||
        nombreEquipo(o.equipoId).toLowerCase().includes(q) ||
        nombreTecnico(o.tecnicoId).toLowerCase().includes(q) ||
        o.tipoServicio.toLowerCase().includes(q)
      const coincideEstado = estadoFiltro === "todos" || o.estado === estadoFiltro
      return coincide && coincideEstado
    })
    .sort((a, b) => b.folio.localeCompare(a.folio))

  const openNueva = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (orden: OrdenServicio) => {
    setEditing(orden)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Órdenes de servicio"
        description="Gestión de órdenes de servicio técnico."
        actions={
          <Button onClick={openNueva}>
            <Plus data-icon="inline-start" />
            Nueva orden
          </Button>
        }
      />

      <PendientesAsignacion />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, cliente o tipo…"
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
                {ESTADOS_ORDEN.map((estado) => (
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
                  <ClipboardList />
                </EmptyMedia>
                <EmptyTitle>Sin órdenes</EmptyTitle>
                <EmptyDescription>
                  No se encontraron órdenes con ese criterio.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
            {/* Vista de campo (móvil): tarjetas táctiles para el técnico */}
            <ul className="flex flex-col gap-3 md:hidden">
              {filtradas.map((o) => (
                <li key={o.id}>
                  <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                    <Link
                      href={`/ordenes/${o.id}`}
                      className="flex flex-col gap-2 rounded-md transition-colors active:bg-muted/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-primary">
                          {o.folio}
                        </span>
                        <EstadoOrdenBadge estado={o.estado} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {nombreCliente(o.clienteId)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {nombreEquipo(o.equipoId)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{o.tipoServicio}</span>
                        <span>{formatFecha(o.fechaProgramada ?? o.fechaSolicitud)}</span>
                      </div>
                    </Link>
                    <AccionesRapidasTecnico orden={o} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Vista de escritorio: tabla completa con acciones */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">Equipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Técnico</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/ordenes/${o.id}`}
                          className="font-mono text-sm font-medium text-primary hover:underline"
                        >
                          {o.folio}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {o.tipoServicio}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">
                        {nombreCliente(o.clienteId)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {nombreEquipo(o.equipoId)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {nombreTecnico(o.tecnicoId)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatFecha(o.fechaProgramada ?? o.fechaSolicitud)}
                      </TableCell>
                      <TableCell>
                        <EstadoOrdenBadge estado={o.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/ordenes/${o.id}`} />} nativeButton={false}
                            aria-label="Ver orden"
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditar(o)}
                            aria-label="Editar orden"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(o)}
                            aria-label="Eliminar orden"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <OrdenFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orden={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar orden?"
        description={
          <>
            Se eliminará la orden <strong>{deleting?.folio}</strong>. Esta acción no se
            puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarOrden(deleting.id)
        }}
      />
    </>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Eye, Pencil, Ticket as TicketIcon, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import {
  EstadoTicketBadge,
  PrioridadTicketBadge,
} from "@/components/status-badges"
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
import { ESTADOS_TICKET, type Ticket } from "@/lib/types"

export default function TicketsPage() {
  const { tickets, clientes, equipos, eliminarTicket } = useStore()
  const [query, setQuery] = React.useState("")
  const [estadoFiltro, setEstadoFiltro] = React.useState<string>("todos")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Ticket | null>(null)
  const [deleting, setDeleting] = React.useState<Ticket | null>(null)

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const nombreEquipo = (id: string | null) => {
    if (!id) return "—"
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "—"
  }

  const filtrados = tickets
    .filter((t) => {
      const q = query.toLowerCase()
      const coincide =
        t.folio.toLowerCase().includes(q) ||
        nombreCliente(t.clienteId).toLowerCase().includes(q) ||
        t.tipoServicio.toLowerCase().includes(q)
      const coincideEstado = estadoFiltro === "todos" || t.estado === estadoFiltro
      return coincide && coincideEstado
    })
    .sort((a, b) => b.folio.localeCompare(a.folio))

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (ticket: Ticket) => {
    setEditing(ticket)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Tickets"
        description="Solicitudes de servicio recibidas de los clientes."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nuevo ticket
          </Button>
        }
      />

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
                {ESTADOS_TICKET.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtrados.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TicketIcon />
                </EmptyMedia>
                <EmptyTitle>Sin tickets</EmptyTitle>
                <EmptyDescription>
                  No se encontraron tickets con ese criterio.
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
                    <TableHead className="hidden md:table-cell">Equipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Prioridad</TableHead>
                    <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-mono text-sm font-medium text-primary hover:underline"
                        >
                          {t.folio}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {t.tipoServicio}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">
                        {nombreCliente(t.clienteId)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {nombreEquipo(t.equipoId)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <PrioridadTicketBadge prioridad={t.prioridad} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatFecha(t.fechaSolicitud)}
                      </TableCell>
                      <TableCell>
                        <EstadoTicketBadge estado={t.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/tickets/${t.id}`} />} nativeButton={false}
                            aria-label="Ver ticket"
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditar(t)}
                            aria-label="Editar ticket"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(t)}
                            aria-label="Eliminar ticket"
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
          )}
        </CardContent>
      </Card>

      <TicketFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ticket={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar ticket?"
        description={
          <>
            Se eliminará el ticket <strong>{deleting?.folio}</strong>. Esta acción no
            se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarTicket(deleting.id)
        }}
      />
    </>
  )
}

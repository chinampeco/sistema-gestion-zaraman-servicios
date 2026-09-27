"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Eye, Pencil, Wrench, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EquipoFormDialog } from "@/components/equipos/equipo-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { EstadoEquipoBadge } from "@/components/status-badges"
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
import { ESTADOS_EQUIPO, type Equipo } from "@/lib/types"

export default function EquiposPage() {
  const { equipos, clientes, eliminarEquipo } = useStore()
  const [query, setQuery] = React.useState("")
  const [estadoFiltro, setEstadoFiltro] = React.useState<string>("todos")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Equipo | null>(null)
  const [deleting, setDeleting] = React.useState<Equipo | null>(null)

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"

  const filtrados = equipos.filter((e) => {
    const q = query.toLowerCase()
    const coincide =
      e.tipo.toLowerCase().includes(q) ||
      e.marca.toLowerCase().includes(q) ||
      e.modelo.toLowerCase().includes(q) ||
      e.numeroSerie.toLowerCase().includes(q) ||
      nombreCliente(e.clienteId).toLowerCase().includes(q)
    const coincideEstado = estadoFiltro === "todos" || e.estado === estadoFiltro
    return coincide && coincideEstado
  })

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (equipo: Equipo) => {
    setEditing(equipo)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Equipos"
        description="Inventario de equipos industriales por cliente."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Registrar equipo
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo, marca, serie o cliente…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={estadoFiltro} onValueChange={(v) => setEstadoFiltro(v as string)}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_EQUIPO.map((estado) => (
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
                  <Wrench />
                </EmptyMedia>
                <EmptyTitle>Sin equipos</EmptyTitle>
                <EmptyDescription>
                  No se encontraron equipos con ese criterio.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead className="hidden lg:table-cell">Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">No. de serie</TableHead>
                    <TableHead className="hidden xl:table-cell">Próximo servicio</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          href={`/equipos/${e.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.tipo}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {e.marca} {e.modelo} · {e.capacidad}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {nombreCliente(e.clienteId)}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">
                        {e.numeroSerie}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {formatFecha(e.fechaProximoServicio)}
                      </TableCell>
                      <TableCell>
                        <EstadoEquipoBadge estado={e.estado} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/equipos/${e.id}`} />} nativeButton={false}
                            aria-label="Ver equipo"
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditar(e)}
                            aria-label="Editar equipo"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(e)}
                            aria-label="Eliminar equipo"
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

      <EquipoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipo={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar equipo?"
        description={
          <>
            Se eliminará <strong>{deleting?.tipo} {deleting?.marca}</strong>. Las órdenes
            asociadas quedarán sin equipo vinculado. Esta acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarEquipo(deleting.id)
        }}
      />
    </>
  )
}

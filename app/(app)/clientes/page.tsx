"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Eye, Pencil, Building2, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import type { Cliente } from "@/lib/types"

export default function ClientesPage() {
  const { clientes, equipos, ordenes, eliminarCliente } = useStore()
  const [query, setQuery] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Cliente | null>(null)
  const [deleting, setDeleting] = React.useState<Cliente | null>(null)

  const filtrados = clientes.filter((c) => {
    const q = query.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.rfc.toLowerCase().includes(q) ||
      c.contacto.toLowerCase().includes(q) ||
      c.ciudad.toLowerCase().includes(q)
    )
  })

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (cliente: Cliente) => {
    setEditing(cliente)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Administra los clientes de ZARAMAN Servicios."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nuevo cliente
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, RFC, contacto o ciudad…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {filtrados.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 />
                </EmptyMedia>
                <EmptyTitle>Sin clientes</EmptyTitle>
                <EmptyDescription>
                  No se encontraron clientes con ese criterio de búsqueda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">RFC</TableHead>
                    <TableHead className="hidden lg:table-cell">Contacto</TableHead>
                    <TableHead className="hidden sm:table-cell">Ciudad</TableHead>
                    <TableHead className="text-center">Equipos</TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c) => {
                    const numEquipos = equipos.filter((e) => e.clienteId === c.id).length
                    const numOrdenes = ordenes.filter((o) => o.clienteId === c.id).length
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/clientes/${c.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {c.nombre}
                          </Link>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {c.ciudad}
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs md:table-cell">
                          {c.rfc}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {c.contacto}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {c.ciudad}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {numEquipos}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {numOrdenes}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              render={<Link href={`/clientes/${c.id}`} />} nativeButton={false}
                              aria-label="Ver cliente"
                            >
                              <Eye />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditar(c)}
                              aria-label="Editar cliente"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(c)}
                              aria-label="Eliminar cliente"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
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

      <ClienteFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cliente={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar cliente?"
        description={
          <>
            Se eliminará <strong>{deleting?.nombre}</strong> y sus equipos asociados. Esta
            acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarCliente(deleting.id)
        }}
      />
    </>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, Pencil, Wrench, Mail, Phone, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { TecnicoFormDialog } from "@/components/tecnicos/tecnico-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import type { Tecnico } from "@/lib/types"

export default function TecnicosPage() {
  const { tecnicos, ordenes, eliminarTecnico } = useStore()
  const [query, setQuery] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Tecnico | null>(null)
  const [deleting, setDeleting] = React.useState<Tecnico | null>(null)

  const filtrados = tecnicos.filter((t) => {
    const q = query.toLowerCase()
    return (
      t.nombre.toLowerCase().includes(q) ||
      t.rol.toLowerCase().includes(q) ||
      t.especialidad.toLowerCase().includes(q)
    )
  })

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (tecnico: Tecnico) => {
    setEditing(tecnico)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Técnicos"
        description="Personal técnico de ZARAMAN Servicios."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nuevo técnico
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, rol o especialidad…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {filtrados.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Wrench />
                </EmptyMedia>
                <EmptyTitle>Sin técnicos</EmptyTitle>
                <EmptyDescription>
                  No se encontraron técnicos con ese criterio de búsqueda.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="hidden md:table-cell">Rol</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Especialidad
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Contacto
                    </TableHead>
                    <TableHead className="text-center">Órdenes</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => {
                    const numOrdenes = ordenes.filter(
                      (o) => o.tecnicoId === t.id,
                    ).length
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            href={`/tecnicos/${t.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {t.nombre}
                          </Link>
                          <div className="text-xs text-muted-foreground md:hidden">
                            {t.rol}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {t.rol}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="font-medium">{t.especialidad || "—"}</div>
                          {t.zona ? (
                            <div className="text-xs text-muted-foreground">
                              Zona: {t.zona}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            {t.email && (
                              <span className="flex items-center gap-1.5">
                                <Mail className="size-3" />
                                {t.email}
                              </span>
                            )}
                            {t.telefono && (
                              <span className="flex items-center gap-1.5">
                                <Phone className="size-3" />
                                {t.telefono}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {numOrdenes}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={t.activo ? "success" : "secondary"}>
                            {t.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditar(t)}
                              aria-label="Editar técnico"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(t)}
                              aria-label="Eliminar técnico"
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

      <TecnicoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tecnico={editing}
      />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar técnico?"
        description={
          <>
            Se eliminará <strong>{deleting?.nombre}</strong>. Las órdenes asignadas
            quedarán sin técnico. Esta acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarTecnico(deleting.id)
        }}
      />
    </>
  )
}

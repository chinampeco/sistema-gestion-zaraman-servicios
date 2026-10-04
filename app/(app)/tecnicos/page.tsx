"use client"

import * as React from "react"
import Link from "next/link"
import { Search, UserCog, Wrench } from "lucide-react"

import { PageHeader } from "@/components/page-header"
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
import { puedeGestionarUsuarios } from "@/lib/permisos"
import { useStore } from "@/lib/store"

// Los técnicos son las cuentas con rol 'tecnico' activas. Se dan de alta y se
// editan en Configuración → Usuarios; aquí solo se consulta su carga de trabajo.
export default function TecnicosPage() {
  const { tecnicos, ordenes, usuarioActual, cargando } = useStore()
  const [query, setQuery] = React.useState("")
  const esAdmin = puedeGestionarUsuarios(usuarioActual.rol)

  const filtrados = tecnicos.filter((t) =>
    t.nombre.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <>
      <PageHeader
        title="Técnicos"
        description="Personal técnico activo de ZARAMAN Servicios."
        actions={
          esAdmin ? (
            <Button
              variant="outline"
              render={<Link href="/configuracion" />}
              nativeButton={false}
            >
              <UserCog data-icon="inline-start" />
              Gestionar cuentas
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre…"
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
                <EmptyTitle>{cargando ? "Cargando…" : "Sin técnicos"}</EmptyTitle>
                <EmptyDescription>
                  {query
                    ? "No se encontraron técnicos con ese nombre."
                    : "Para agregar un técnico, crea o activa una cuenta con rol Técnico en Configuración → Usuarios."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-center">Órdenes abiertas</TableHead>
                    <TableHead className="text-center">Órdenes totales</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((t) => {
                    const suyas = ordenes.filter((o) => o.tecnicoId === t.id)
                    const abiertas = suyas.filter(
                      (o) => o.estado !== "Terminada" && o.estado !== "Cancelada",
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
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{abiertas}</TableCell>
                        <TableCell className="text-center tabular-nums">{suyas.length}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={t.activo ? "success" : "secondary"}>
                            {t.activo ? "Activo" : "Inactivo"}
                          </Badge>
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
    </>
  )
}

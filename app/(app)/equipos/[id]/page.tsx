"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EquipoFormDialog } from "@/components/equipos/equipo-form-dialog"
import { EstadoEquipoBadge, EstadoOrdenBadge } from "@/components/status-badges"
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
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"

export default function EquipoDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { equipos, clientes, ordenes } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)

  const equipo = equipos.find((e) => e.id === params.id)

  if (!equipo) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Equipo no encontrado</EmptyTitle>
          <EmptyDescription>
            El equipo que buscas no existe o fue eliminado.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/equipos")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a equipos
        </Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === equipo.clienteId)
  const historial = ordenes
    .filter((o) => o.equipoId === equipo.id)
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud))

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/equipos" />} nativeButton={false}
          aria-label="Volver"
        >
          <ArrowLeft />
        </Button>
        <PageHeader
          title={`${equipo.tipo} · ${equipo.marca} ${equipo.modelo}`}
          description={cliente ? cliente.nombre : undefined}
          actions={
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Ficha técnica</CardTitle>
            <EstadoEquipoBadge estado={equipo.estado} />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info label="Cliente" value={cliente?.nombre ?? "—"} />
            <Info label="Número de serie" value={equipo.numeroSerie} mono />
            <Info label="Capacidad" value={equipo.capacidad} />
            <Info label="Ubicación" value={equipo.ubicacion} />
            <Info label="Fecha de instalación" value={formatFecha(equipo.fechaInstalacion)} />
            <Info label="Último servicio" value={formatFecha(equipo.fechaUltimoServicio)} />
            <Info label="Próximo servicio" value={formatFecha(equipo.fechaProximoServicio)} />
            <div className="sm:col-span-2">
              <Info label="Notas" value={equipo.notas || "—"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Info label="Servicios realizados" value={String(historial.length)} />
            <Info
              label="Marca / Modelo"
              value={`${equipo.marca} ${equipo.modelo}`}
            />
            <Info label="Tipo de equipo" value={equipo.tipo} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de mantenimiento</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {historial.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">
              Este equipo no tiene órdenes de servicio registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Solicitud</TableHead>
                  <TableHead className="hidden md:table-cell">Cierre</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/ordenes/${o.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {o.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {o.tipoServicio}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatFecha(o.fechaSolicitud)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatFecha(o.fechaCierre)}
                    </TableCell>
                    <TableCell>
                      <EstadoOrdenBadge estado={o.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EquipoFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        equipo={equipo}
      />
    </>
  )
}

function Info({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value}</span>
    </div>
  )
}

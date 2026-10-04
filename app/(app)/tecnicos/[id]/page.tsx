"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Wrench,
  Clock,
  Users,
  HardDrive,
  ClipboardList,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { EstadoOrdenBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"

export default function TecnicoDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { tecnicos, ordenes, clientes, equipos, cargando } = useStore()

  const tecnico = tecnicos.find((t) => t.id === params.id)

  const ordenesTecnico = React.useMemo(
    () => ordenes.filter((o) => o.tecnicoId === params.id),
    [ordenes, params.id],
  )

  const stats = React.useMemo(() => {
    const pendientes = ordenesTecnico.filter((o) =>
      ["Pendiente", "Programada", "En espera"].includes(o.estado),
    ).length
    const enProceso = ordenesTecnico.filter((o) => o.estado === "En proceso").length
    const terminadas = ordenesTecnico.filter((o) => o.estado === "Terminada").length
    const horas = ordenesTecnico.reduce((sum, o) => sum + (o.horasTrabajadas ?? 0), 0)
    const equiposAtendidos = new Set(ordenesTecnico.map((o) => o.equipoId)).size
    const clientesAtendidos = new Set(ordenesTecnico.map((o) => o.clienteId)).size
    return { pendientes, enProceso, terminadas, horas, equiposAtendidos, clientesAtendidos }
  }, [ordenesTecnico])

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const nombreEquipo = (id: string) => {
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "—"
  }

  if (!tecnico) {
    return (
      <>
        <PageHeader title="Técnico" description="Detalle del técnico." />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wrench />
            </EmptyMedia>
            <EmptyTitle>
              {cargando ? "Cargando…" : "Técnico no encontrado"}
            </EmptyTitle>
            <EmptyDescription>
              {cargando
                ? "Un momento."
                : "El técnico que buscas no existe o su cuenta está inactiva."}
            </EmptyDescription>
          </EmptyHeader>
          {!cargando && (
            <Button variant="outline" onClick={() => router.push("/tecnicos")}>
              <ArrowLeft data-icon="inline-start" />
              Volver a técnicos
            </Button>
          )}
        </Empty>
      </>
    )
  }

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" render={<Link href="/tecnicos" />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Técnicos
        </Button>
      </div>

      <PageHeader
        title={tecnico.nombre}
        description="Técnico"
        actions={
          <Badge variant={tecnico.activo ? "success" : "secondary"}>
            {tecnico.activo ? "Activo" : "Inactivo"}
          </Badge>
        }
      />

      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Servicios pendientes"
            value={stats.pendientes}
            icon={ClipboardList}
            hint="Pendiente, programada o en espera"
          />
          <StatCard
            label="En proceso"
            value={stats.enProceso}
            icon={Wrench}
            accent
          />
          <StatCard
            label="Terminados"
            value={stats.terminadas}
            icon={ClipboardList}
          />
          <StatCard
            label="Horas trabajadas"
            value={stats.horas}
            icon={Clock}
            hint="Suma de horas de sus órdenes"
          />
          <StatCard
            label="Equipos atendidos"
            value={stats.equiposAtendidos}
            icon={HardDrive}
          />
          <StatCard
            label="Clientes atendidos"
            value={stats.clientesAtendidos}
            icon={Users}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Órdenes asignadas</CardTitle>
          </CardHeader>
          <CardContent>
            {ordenesTecnico.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClipboardList />
                  </EmptyMedia>
                  <EmptyTitle>Sin órdenes asignadas</EmptyTitle>
                  <EmptyDescription>
                    Este técnico no tiene órdenes de servicio asignadas.
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
                      <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesTecnico
                      .slice()
                      .sort((a, b) => b.folio.localeCompare(a.folio))
                      .map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Link
                              href={`/ordenes/${o.id}`}
                              className="font-mono text-sm font-medium text-primary hover:underline"
                            >
                              {o.folio}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-40 truncate">
                            {nombreCliente(o.clienteId)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {nombreEquipo(o.equipoId)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {formatFecha(o.fechaProgramada ?? o.fechaSolicitud)}
                          </TableCell>
                          <TableCell>
                            <EstadoOrdenBadge estado={o.estado} />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

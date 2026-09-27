"use client"

import * as React from "react"
import Link from "next/link"
import {
  ClipboardList,
  Clock,
  Loader2,
  CheckCircle2,
  Users,
  Wrench,
  CalendarClock,
  ArrowRight,
  CalendarDays,
  FileText,
  Receipt,
  UserPlus,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { EstadoOrdenBadge, PrioridadBadge } from "@/components/status-badges"
import { OrdenesPorMesChart } from "@/components/charts/ordenes-por-mes-chart"
import { useStore } from "@/lib/store"
import { formatFecha, formatMoneda } from "@/lib/format"
import { ESTADOS_ORDEN } from "@/lib/types"

export default function DashboardPage() {
  const { ordenes, clientes, equipos, tecnicos, cotizaciones, facturas } = useStore()

  const pendientes = ordenes.filter((o) => o.estado === "Pendiente").length
  const pendientesAsignacion = ordenes.filter(
    (o) => o.estado === "Pendiente de asignación",
  ).length
  const enProceso = ordenes.filter((o) => o.estado === "En proceso").length
  const programadas = ordenes.filter((o) => o.estado === "Programada").length
  const terminadas = ordenes.filter((o) => o.estado === "Terminada").length

  const clienteNombre = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const tecnicoNombre = (id: string | null) =>
    tecnicos.find((t) => t.id === id)?.nombre ?? "Sin asignar"
  const equipoNombre = (id: string) => {
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "—"
  }

  const hoyISO = React.useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [])

  const serviciosHoy = React.useMemo(
    () =>
      ordenes
        .filter((o) => o.fechaProgramada === hoyISO)
        .sort((a, b) =>
          (a.horaProgramada ?? "").localeCompare(b.horaProgramada ?? ""),
        ),
    [ordenes, hoyISO],
  )

  const cotizacionesPendientes = cotizaciones.filter((c) =>
    ["Borrador", "Enviada", "Vista"].includes(c.estado),
  ).length

  const porCobrar = facturas.reduce((sum, f) => sum + (f.saldo ?? 0), 0)

  const ordenesRecientes = [...ordenes]
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud))
    .slice(0, 6)

  const proximosServicios = [...equipos]
    .filter((e) => e.fechaProximoServicio)
    .sort((a, b) =>
      (a.fechaProximoServicio ?? "").localeCompare(b.fechaProximoServicio ?? "")
    )
    .slice(0, 5)

  const distribucion = ESTADOS_ORDEN.map((estado) => ({
    estado,
    total: ordenes.filter((o) => o.estado === estado).length,
  }))
  const totalOrdenes = ordenes.length || 1

  const tecnicosActivos = tecnicos.filter((t) => t.activo).length

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen operativo de servicios técnicos industriales."
      />

      {pendientesAsignacion > 0 && (
        <Link
          href="/ordenes"
          className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 transition-colors hover:bg-warning/15"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-warning/20 text-warning">
              <UserPlus className="size-4.5" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {pendientesAsignacion}{" "}
                {pendientesAsignacion === 1
                  ? "orden pendiente de asignación"
                  : "órdenes pendientes de asignación"}
              </span>
              <span className="text-xs text-muted-foreground">
                Trabajos aceptados por clientes que esperan un técnico responsable.
              </span>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Órdenes pendientes"
          value={pendientes}
          icon={Clock}
          accent="warning"
          hint="Requieren asignación"
        />
        <StatCard
          label="En proceso"
          value={enProceso}
          icon={Loader2}
          accent="info"
          hint="En atención actualmente"
        />
        <StatCard
          label="Programadas"
          value={programadas}
          icon={CalendarClock}
          accent="default"
          hint="Con fecha asignada"
        />
        <StatCard
          label="Terminadas"
          value={terminadas}
          icon={CheckCircle2}
          accent="success"
          hint="Cerradas correctamente"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Órdenes de servicio por mes</CardTitle>
            <CardDescription>
              Volumen de órdenes registradas en el año.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrdenesPorMesChart ordenes={ordenes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución por estado</CardTitle>
            <CardDescription>Total: {ordenes.length} órdenes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {distribucion.map((d) => (
              <div key={d.estado} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{d.estado}</span>
                  <span className="font-medium tabular-nums">{d.total}</span>
                </div>
                <Progress value={(d.total / totalOrdenes) * 100} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Servicios de hoy</CardTitle>
            <CardDescription>
              Órdenes programadas para {formatFecha(hoyISO)}.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/agenda" />} nativeButton={false}>
            Ver agenda
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardHeader>
        <CardContent>
          {serviciosHoy.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarDays className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No hay servicios programados para hoy.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {serviciosHoy.map((o) => (
                <Link
                  key={o.id}
                  href={`/ordenes/${o.id}`}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium text-primary">
                      {o.folio}
                    </span>
                    <EstadoOrdenBadge estado={o.estado} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span className="font-medium text-foreground">
                      {o.horaProgramada ?? "Sin hora"}
                    </span>
                  </div>
                  <span className="truncate text-sm font-medium">
                    {clienteNombre(o.clienteId)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {equipoNombre(o.equipoId)}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tecnicoNombre(o.tecnicoId)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Clientes activos" value={clientes.length} icon={Users} />
        <StatCard label="Equipos registrados" value={equipos.length} icon={Wrench} />
        <StatCard
          label="Técnicos activos"
          value={tecnicosActivos}
          icon={ClipboardList}
        />
        <StatCard
          label="Cotizaciones pendientes"
          value={cotizacionesPendientes}
          icon={FileText}
          accent="info"
        />
        <StatCard
          label="Por cobrar"
          value={formatMoneda(porCobrar)}
          icon={Receipt}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle>Órdenes recientes</CardTitle>
              <CardDescription>Últimas solicitudes registradas.</CardDescription>
            </div>
            <Button variant="outline" size="sm" render={<Link href="/ordenes" />} nativeButton={false}>
              Ver todas
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenesRecientes.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/ordenes/${o.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {o.folio}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {clienteNombre(o.clienteId)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <PrioridadBadge prioridad={o.prioridad} />
                    </TableCell>
                    <TableCell>
                      <EstadoOrdenBadge estado={o.estado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos servicios</CardTitle>
            <CardDescription>Equipos con mantenimiento agendado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {proximosServicios.map((e) => (
              <Link
                key={e.id}
                href={`/equipos/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {e.tipo} · {e.marca}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {clienteNombre(e.clienteId)}
                  </span>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {formatFecha(e.fechaProximoServicio)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

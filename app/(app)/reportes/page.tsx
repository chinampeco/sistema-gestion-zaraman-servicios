"use client"

import * as React from "react"
import Link from "next/link"
import { Printer, CheckCircle2, Clock, Wrench, Users } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { EstadoOrdenBadge } from "@/components/status-badges"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { useStore } from "@/lib/store"
import { formatFecha, nombreTecnico } from "@/lib/format"
import { ESTADOS_ORDEN } from "@/lib/types"

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

export default function ReportesPage() {
  const { ordenes, clientes, equipos, tecnicos } = useStore()

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const etiquetaEquipo = (id: string) => {
    const e = equipos.find((eq) => eq.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}` : "—"
  }
  const tecnicoDe = (id: string | null) => nombreTecnico(tecnicos, id)

  // Filtros por sección
  const [clienteSel, setClienteSel] = React.useState<string>(
    clientes[0]?.id ?? "",
  )
  const [equipoSel, setEquipoSel] = React.useState<string>(
    equipos[0]?.id ?? "",
  )
  const [tecnicoSel, setTecnicoSel] = React.useState<string>(
    tecnicos[0]?.id ?? "",
  )
  const [periodoSel, setPeriodoSel] = React.useState<string>("todos")

  const conteoPorEstado = ESTADOS_ORDEN.map((estado) => ({
    estado,
    total: ordenes.filter((o) => o.estado === estado).length,
  }))

  const ordenesCliente = ordenes.filter((o) => o.clienteId === clienteSel)
  const ordenesEquipo = ordenes.filter((o) => o.equipoId === equipoSel)
  const ordenesTecnico = ordenes.filter((o) => o.tecnicoId === tecnicoSel)

  const periodos = React.useMemo(() => {
    const set = new Set<string>()
    ordenes.forEach((o) => set.add(o.fechaSolicitud.slice(0, 7)))
    return Array.from(set).sort().reverse()
  }, [ordenes])

  const ordenesPeriodo =
    periodoSel === "todos"
      ? ordenes
      : ordenes.filter((o) => o.fechaSolicitud.slice(0, 7) === periodoSel)

  const formatPeriodo = (ym: string) => {
    const [y, m] = ym.split("-")
    return `${MESES[Number(m) - 1]} ${y}`
  }

  // Servicios realizados (órdenes terminadas)
  const [periodoRealizados, setPeriodoRealizados] = React.useState<string>("todos")
  const serviciosRealizados = React.useMemo(() => {
    const terminadas = ordenes.filter((o) => o.estado === "Terminada")
    const filtradas =
      periodoRealizados === "todos"
        ? terminadas
        : terminadas.filter(
            (o) => (o.fechaCierre ?? o.fechaSolicitud).slice(0, 7) === periodoRealizados,
          )
    return [...filtradas].sort((a, b) =>
      (b.fechaCierre ?? "").localeCompare(a.fechaCierre ?? ""),
    )
  }, [ordenes, periodoRealizados])

  const totalHorasRealizadas = serviciosRealizados.reduce(
    (sum, o) => sum + (o.horasTrabajadas ?? 0),
    0,
  )
  const equiposAtendidos = new Set(serviciosRealizados.map((o) => o.equipoId)).size
  const clientesAtendidos = new Set(serviciosRealizados.map((o) => o.clienteId)).size

  const imprimir = () => window.print()

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Consulta y analiza la actividad de servicio."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {conteoPorEstado.map(({ estado, total }) => (
          <Card key={estado}>
            <CardContent className="flex flex-col gap-1 py-4">
              <span className="text-2xl font-semibold tabular-nums">
                {total}
              </span>
              <EstadoOrdenBadge estado={estado} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="ordenes" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="ordenes">Órdenes</TabsTrigger>
          <TabsTrigger value="realizados">Servicios realizados</TabsTrigger>
          <TabsTrigger value="cliente">Por cliente</TabsTrigger>
          <TabsTrigger value="equipo">Por equipo</TabsTrigger>
          <TabsTrigger value="tecnico">Por técnico</TabsTrigger>
          <TabsTrigger value="periodo">Por periodo</TabsTrigger>
        </TabsList>

        {/* Reporte general de órdenes */}
        <TabsContent value="ordenes">
          <Card>
            <CardHeader>
              <CardTitle>Reporte de órdenes</CardTitle>
            </CardHeader>
            <CardContent>
              <OrdenesTable
                ordenes={ordenes}
                nombreCliente={nombreCliente}
                nombreTecnico={tecnicoDe}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servicios realizados */}
        <TabsContent value="realizados">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Servicios realizados"
                value={serviciosRealizados.length}
                icon={CheckCircle2}
                accent="success"
              />
              <StatCard
                label="Horas trabajadas"
                value={totalHorasRealizadas}
                icon={Clock}
                accent="info"
              />
              <StatCard
                label="Equipos atendidos"
                value={equiposAtendidos}
                icon={Wrench}
              />
              <StatCard
                label="Clientes atendidos"
                value={clientesAtendidos}
                icon={Users}
              />
            </div>

            <Card>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-4">
                <CardTitle>Servicios realizados</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={periodoRealizados} onValueChange={setPeriodoRealizados}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los periodos</SelectItem>
                      {periodos.map((p) => (
                        <SelectItem key={p} value={p}>
                          {formatPeriodo(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={imprimir}>
                    <Printer data-icon="inline-start" />
                    Imprimir
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {serviciosRealizados.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay servicios realizados en el periodo seleccionado.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folio</TableHead>
                          <TableHead className="hidden md:table-cell">Cliente</TableHead>
                          <TableHead className="hidden lg:table-cell">Equipo</TableHead>
                          <TableHead className="hidden lg:table-cell">Técnico</TableHead>
                          <TableHead className="hidden sm:table-cell">Cierre</TableHead>
                          <TableHead className="text-right">Horas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviciosRealizados.map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>
                              <Link
                                href={`/ordenes/${o.id}`}
                                className="font-mono text-xs font-medium text-primary hover:underline"
                              >
                                {o.folio}
                              </Link>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {nombreCliente(o.clienteId)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {etiquetaEquipo(o.equipoId)}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {tecnicoDe(o.tecnicoId)}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {formatFecha(o.fechaCierre)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {o.horasTrabajadas ?? "—"}
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
        </TabsContent>

        {/* Historial por cliente */}
        <TabsContent value="cliente">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Historial por cliente</CardTitle>
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Selecciona cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <OrdenesTable
                ordenes={ordenesCliente}
                nombreCliente={nombreCliente}
                nombreTecnico={tecnicoDe}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historial por equipo */}
        <TabsContent value="equipo">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Historial por equipo</CardTitle>
              <Select value={equipoSel} onValueChange={setEquipoSel}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecciona equipo" />
                </SelectTrigger>
                <SelectContent>
                  {equipos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {etiquetaEquipo(e.id)} · {e.numeroSerie}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <OrdenesTable
                ordenes={ordenesEquipo}
                nombreCliente={nombreCliente}
                nombreTecnico={tecnicoDe}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servicios por técnico */}
        <TabsContent value="tecnico">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Servicios por técnico</CardTitle>
              <Select value={tecnicoSel} onValueChange={setTecnicoSel}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Selecciona técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <OrdenesTable
                ordenes={ordenesTecnico}
                nombreCliente={nombreCliente}
                nombreTecnico={tecnicoDe}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servicios por periodo */}
        <TabsContent value="periodo">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>Servicios por periodo</CardTitle>
              <Select value={periodoSel} onValueChange={setPeriodoSel}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los periodos</SelectItem>
                  {periodos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {formatPeriodo(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <OrdenesTable
                ordenes={ordenesPeriodo}
                nombreCliente={nombreCliente}
                nombreTecnico={tecnicoDe}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

function OrdenesTable({
  ordenes,
  nombreCliente,
  nombreTecnico,
}: {
  ordenes: ReturnType<typeof useStore>["ordenes"]
  nombreCliente: (id: string) => string
  nombreTecnico: (id: string | null) => string
}) {
  if (ordenes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay órdenes para mostrar.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead className="hidden md:table-cell">Cliente</TableHead>
            <TableHead className="hidden lg:table-cell">Técnico</TableHead>
            <TableHead className="hidden sm:table-cell">Solicitud</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Horas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenes.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Link
                  href={`/ordenes/${o.id}`}
                  className="font-mono text-xs font-medium text-primary hover:underline"
                >
                  {o.folio}
                </Link>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {nombreCliente(o.clienteId)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {nombreTecnico(o.tecnicoId)}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {formatFecha(o.fechaSolicitud)}
              </TableCell>
              <TableCell>
                <EstadoOrdenBadge estado={o.estado} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {o.horasTrabajadas ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

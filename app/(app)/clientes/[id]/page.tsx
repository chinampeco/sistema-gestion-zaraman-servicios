"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Mail, Phone, MapPin, FileText, Plus, KeyRound, CircleCheck, RefreshCw, LogIn } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog"
import { PortalAccessDialog } from "@/components/clientes/portal-access-dialog"
import { EstadoEquipoBadge, EstadoOrdenBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"

export default function ClienteDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { clientes, equipos, ordenes, usuarios } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)
  const [accesoOpen, setAccesoOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)

  const cliente = clientes.find((c) => c.id === params.id)
  const accesoPortal = usuarios.find((u) => u.clienteId === params.id) ?? null

  if (!cliente) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Cliente no encontrado</EmptyTitle>
          <EmptyDescription>
            El cliente que buscas no existe o fue eliminado.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/clientes")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a clientes
        </Button>
      </Empty>
    )
  }

  const equiposCliente = equipos.filter((e) => e.clienteId === cliente.id)
  const ordenesCliente = ordenes
    .filter((o) => o.clienteId === cliente.id)
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud))

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/clientes" />} nativeButton={false}
          aria-label="Volver"
        >
          <ArrowLeft />
        </Button>
        <PageHeader
          title={cliente.nombre}
          description={cliente.rfc ? `RFC: ${cliente.rfc}` : undefined}
          actions={
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          }
        />
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="equipos">
            Equipos ({equiposCliente.length})
          </TabsTrigger>
          <TabsTrigger value="historial">
            Historial ({ordenesCliente.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Datos generales</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Info label="Persona de contacto" value={cliente.contacto} />
                <Info
                  label="Correo electrónico"
                  value={cliente.email}
                  icon={Mail}
                />
                <Info label="Teléfono" value={cliente.telefono} icon={Phone} />
                <Info label="Ciudad / Estado" value={cliente.ciudad} icon={MapPin} />
                <div className="sm:col-span-2">
                  <Info label="Dirección" value={cliente.direccion} />
                </div>
                <div className="sm:col-span-2">
                  <Info label="Notas" value={cliente.notas || "—"} icon={FileText} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Info label="Cliente desde" value={formatFecha(cliente.createdAt)} />
                <Info label="Equipos registrados" value={String(equiposCliente.length)} />
                <Info label="Órdenes totales" value={String(ordenesCliente.length)} />
              </CardContent>
            </Card>
            <Card className="lg:col-span-3">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <CardTitle>Acceso al portal</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Credenciales para que el cliente consulte sus equipos, órdenes,
                    cotizaciones y facturas.
                  </p>
                </div>
                {!accesoPortal && (
                  <Button size="sm" onClick={() => setAccesoOpen(true)}>
                    <KeyRound data-icon="inline-start" />
                    Crear acceso
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {accesoPortal ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 rounded-md border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <CircleCheck className="size-5 shrink-0 text-primary" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            Acceso activo al portal
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {accesoPortal.email}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Button
                          size="sm"
                          className="shrink-0"
                          render={<Link href="/auth/login" target="_blank" rel="noopener noreferrer" />}
                          nativeButton={false}
                        >
                          <LogIn data-icon="inline-start" />
                          Abrir inicio de sesión
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => setResetOpen(true)}
                        >
                          <RefreshCw data-icon="inline-start" />
                          Cambiar contraseña
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">¿Cómo entra el cliente a su portal?</p>
                      <ol className="mt-1 list-decimal space-y-1 pl-4">
                        <li>
                          Abre el <span className="font-medium text-foreground">inicio de sesión</span> (botón de arriba) en el
                          navegador del cliente, o compártele la dirección{" "}
                          <span className="font-medium text-foreground">/auth/login</span>.
                        </li>
                        <li>
                          Escribe el <span className="font-medium text-foreground">correo</span> (
                          {accesoPortal.email}) y la <span className="font-medium text-foreground">contraseña</span> que le
                          entregaste. Entra directo a su portal, sin correos de confirmación.
                        </li>
                        <li>
                          No debe usar <span className="font-medium text-foreground">"Crear cuenta"</span>: esa opción es solo
                          para el personal interno.
                        </li>
                      </ol>
                      <p className="mt-2">
                        Nota: si tú ya iniciaste sesión como personal en este mismo navegador, el portal te devolverá al panel
                        interno. Prueba el portal en una ventana privada o con la sesión del cliente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este cliente aún no tiene acceso al portal. Crea sus credenciales
                    para que pueda iniciar sesión.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="equipos">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Equipos del cliente</CardTitle>
              <Button size="sm" render={<Link href="/equipos" />} nativeButton={false}>
                <Plus data-icon="inline-start" />
                Registrar equipo
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              {equiposCliente.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">
                  Este cliente no tiene equipos registrados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipo</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        No. de serie
                      </TableHead>
                      <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equiposCliente.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <Link
                            href={`/equipos/${e.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {e.tipo} · {e.marca} {e.modelo}
                          </Link>
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs sm:table-cell">
                          {e.numeroSerie}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {e.ubicacion}
                        </TableCell>
                        <TableCell>
                          <EstadoEquipoBadge estado={e.estado} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <CardTitle>Historial de servicios</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {ordenesCliente.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">
                  Este cliente no tiene órdenes de servicio.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Folio</TableHead>
                      <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                      <TableHead className="hidden md:table-cell">Solicitud</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesCliente.map((o) => (
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
        </TabsContent>
      </Tabs>

      <ClienteFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        cliente={cliente}
      />

      <PortalAccessDialog
        open={accesoOpen}
        onOpenChange={setAccesoOpen}
        cliente={cliente}
      />

      <PortalAccessDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        cliente={cliente}
        modo="restablecer"
        emailExistente={accesoPortal?.email}
      />
    </>
  )
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-2 text-sm">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        {value}
      </span>
    </div>
  )
}

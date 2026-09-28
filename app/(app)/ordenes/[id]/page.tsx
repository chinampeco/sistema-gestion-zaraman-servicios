"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Pencil, FileText, Receipt, UserCog } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { OrdenFormDialog } from "@/components/ordenes/orden-form-dialog"
import { OrdenMateriales } from "@/components/ordenes/orden-materiales"
import { OrdenEvidencias } from "@/components/ordenes/orden-evidencias"
import { OrdenFirma } from "@/components/ordenes/orden-firma"
import { EstadoOrdenBadge, PrioridadBadge } from "@/components/status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { puedeReasignarOrdenes } from "@/lib/permisos"
import { formatFecha, formatHora } from "@/lib/format"

export default function OrdenDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { ordenes, clientes, equipos, tecnicos, usuarios, cotizaciones, facturas, usuarioActual, actualizarOrden } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)

  const orden = ordenes.find((o) => o.id === params.id)

  if (!orden) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Orden no encontrada</EmptyTitle>
          <EmptyDescription>La orden que buscas no existe o fue eliminada.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/ordenes")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a órdenes
        </Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === orden.clienteId)
  const equipo = equipos.find((e) => e.id === orden.equipoId)
  const tecnico = tecnicos.find((t) => t.id === orden.tecnicoId)
  const creador = usuarios.find((u) => u.id === orden.creadoPor)
  const cotizacion = cotizaciones.find((c) => c.ordenId === orden.id)
  const factura = facturas.find((f) => f.ordenId === orden.id)
  const puedeGestionarOrden = puedeReasignarOrdenes(usuarioActual.rol) && !orden.firmaCliente

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/ordenes" />} nativeButton={false} aria-label="Volver">
          <ArrowLeft />
        </Button>
        <PageHeader
          title={orden.folio}
          description={cliente?.nombre}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link href={`/ordenes/${orden.id}/reporte`} />} nativeButton={false}>
                <FileText data-icon="inline-start" />
                Reporte PDF
              </Button>
              {puedeGestionarOrden ? (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EstadoOrdenBadge estado={orden.estado} />
        <PrioridadBadge prioridad={orden.prioridad} />
        <Badge variant="outline">{orden.tipoServicio}</Badge>
        {cotizacion ? (
          <Button variant="ghost" size="sm" render={<Link href={`/cotizaciones/${cotizacion.id}`} />} nativeButton={false}>
            <FileText data-icon="inline-start" />
            {cotizacion.folio}
          </Button>
        ) : null}
        {factura ? (
          <Button variant="ghost" size="sm" render={<Link href={`/facturas/${factura.id}`} />} nativeButton={false}>
            <Receipt data-icon="inline-start" />
            {factura.folio}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Detalle del servicio</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Bloque label="Descripción de la falla" value={orden.descripcionFalla} />
            <Separator />
            <Bloque label="Diagnóstico" value={orden.diagnostico} />
            <Separator />
            <Bloque label="Trabajo realizado" value={orden.trabajoRealizado} />
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Bloque label="Resumen de materiales" value={orden.materiales} />
              <Bloque label="Observaciones" value={orden.observaciones} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Referencias</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Cliente">
                {cliente ? <Link href={`/clientes/${cliente.id}`} className="text-primary hover:underline">{cliente.nombre}</Link> : "—"}
              </Dato>
              <Dato label="Equipo">
                {equipo ? <Link href={`/equipos/${equipo.id}`} className="text-primary hover:underline">{equipo.tipo} · {equipo.marca} {equipo.modelo}</Link> : "—"}
              </Dato>
              <Dato label="Técnico responsable">
                {tecnico?.nombre ?? "Sin asignar"}
                {tecnico?.zona ? <span className="block text-xs text-muted-foreground">Zona: {tecnico.zona}</span> : null}
                {puedeGestionarOrden ? (
                  <ReasignarTecnico
                    tecnicos={tecnicos}
                    tecnicoActualId={orden.tecnicoId}
                    onReasignar={async (nuevoId) => {
                      await actualizarOrden(orden.id, { tecnicoId: nuevoId })
                      const nombre = tecnicos.find((t) => t.id === nuevoId)?.nombre ?? "sin asignar"
                      toast.success(nuevoId ? `Orden reasignada a ${nombre}. Se le notificará en su portal.` : "Se quitó el técnico asignado.")
                    }}
                  />
                ) : null}
              </Dato>
              <Dato label="Horas trabajadas">{orden.horasTrabajadas != null ? `${orden.horasTrabajadas} h` : "—"}</Dato>
              <Dato label="Creada por">{creador?.nombre ?? "—"}</Dato>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Fechas</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Solicitud">{formatFecha(orden.fechaSolicitud)}</Dato>
              <Dato label="Programada">{formatFecha(orden.fechaProgramada)}{orden.horaProgramada ? ` · ${formatHora(orden.horaProgramada)}` : ""}</Dato>
              <Dato label="Inicio">{formatFecha(orden.fechaInicio)}</Dato>
              <Dato label="Cierre">{formatFecha(orden.fechaCierre)}</Dato>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Materiales y refacciones utilizados</CardTitle></CardHeader>
        <CardContent><OrdenMateriales orden={orden} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Evidencias fotográficas</CardTitle></CardHeader>
        <CardContent><OrdenEvidencias orden={orden} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Firmas y cierre del servicio</CardTitle></CardHeader>
        <CardContent><OrdenFirma orden={orden} /></CardContent>
      </Card>

      {puedeGestionarOrden ? <OrdenFormDialog open={editOpen} onOpenChange={setEditOpen} orden={orden} /> : null}
    </>
  )
}

function Bloque({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className="text-sm leading-relaxed text-pretty">{value || "—"}</p>
    </div>
  )
}

function ReasignarTecnico({
  tecnicos,
  tecnicoActualId,
  onReasignar,
}: {
  tecnicos: { id: string; nombre: string; activo: boolean }[]
  tecnicoActualId: string | null
  onReasignar: (nuevoId: string | null) => Promise<void>
}) {
  const [valor, setValor] = React.useState(tecnicoActualId ?? "sin-asignar")
  const [guardando, setGuardando] = React.useState(false)

  React.useEffect(() => { setValor(tecnicoActualId ?? "sin-asignar") }, [tecnicoActualId])

  const cambiado = valor !== (tecnicoActualId ?? "sin-asignar")

  const handleGuardar = async () => {
    setGuardando(true)
    try { await onReasignar(valor === "sin-asignar" ? null : valor) }
    finally { setGuardando(false) }
  }

  const activos = tecnicos.filter((t) => t.activo || t.id === tecnicoActualId)

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-dashed p-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <UserCog className="size-3.5" />
        Reasignar técnico
      </span>
      <Select value={valor} onValueChange={(v) => setValor((v as string) ?? "sin-asignar")}>
        <SelectTrigger className="w-full" size="sm"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="sin-asignar">Sin asignar</SelectItem>
          {activos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!cambiado || guardando} onClick={handleGuardar}>
        {guardando ? "Guardando…" : "Reasignar"}
      </Button>
    </div>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

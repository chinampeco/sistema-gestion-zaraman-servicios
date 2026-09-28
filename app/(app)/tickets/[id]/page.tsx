"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Pencil, ClipboardList } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog"
import {
  EstadoTicketBadge,
  PrioridadTicketBadge,
} from "@/components/status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"
import { convertirTicketEnOrdenDirecta } from "@/lib/ticket-conversion"

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { tickets, ordenes, clientes, equipos, usuarios, usuarioActual, recargar } = useStore()
  const [editOpen, setEditOpen] = React.useState(false)
  const [generando, setGenerando] = React.useState(false)

  const ticket = tickets.find((t) => t.id === params.id)

  if (!ticket) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Ticket no encontrado</EmptyTitle>
          <EmptyDescription>
            El ticket que buscas no existe o fue eliminado.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => router.push("/tickets")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a tickets
        </Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === ticket.clienteId)
  const equipo = equipos.find((e) => e.id === ticket.equipoId)
  const creador = usuarios.find((u) => u.id === ticket.creadoPor)
  const orden = ordenes.find((o) => o.id === ticket.ordenId)

  const handleGenerarOrden = async () => {
    if (!usuarioActual.id) {
      toast.error("No se pudo identificar al usuario actual.")
      return
    }

    setGenerando(true)
    const resultado = await convertirTicketEnOrdenDirecta(ticket, usuarioActual.id)
    setGenerando(false)

    if (!resultado) {
      toast.error("No se pudo generar la orden desde el ticket.")
      return
    }

    await recargar()
    toast.success(
      resultado.esGarantia
        ? `${resultado.orden.folio} creada como atención por garantía.`
        : `${resultado.orden.folio} creada como servicio directo.`,
    )
    router.push(`/ordenes/${resultado.orden.id}`)
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href="/tickets" />} nativeButton={false}
          aria-label="Volver"
        >
          <ArrowLeft />
        </Button>
        <PageHeader
          title={ticket.folio}
          description={cliente?.nombre}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
              {!ticket.ordenId && (
                <Button onClick={handleGenerarOrden} disabled={generando}>
                  <ClipboardList data-icon="inline-start" />
                  {generando ? "Generando…" : "Generar orden"}
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EstadoTicketBadge estado={ticket.estado} />
        <PrioridadTicketBadge prioridad={ticket.prioridad} />
        <Badge variant="outline">{ticket.tipoServicio}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Solicitud</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Bloque label="Motivo / descripción" value={ticket.descripcionFalla} />
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Bloque label="Contacto" value={ticket.contacto} />
              <Bloque label="Ubicación" value={ticket.ubicacion} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Referencias</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Cliente">
                {cliente ? (
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="text-primary hover:underline"
                  >
                    {cliente.nombre}
                  </Link>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato label="Equipo">
                {equipo ? (
                  <Link
                    href={`/equipos/${equipo.id}`}
                    className="text-primary hover:underline"
                  >
                    {equipo.tipo} · {equipo.marca} {equipo.modelo}
                  </Link>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato label="Orden generada">
                {orden ? (
                  <Link
                    href={`/ordenes/${orden.id}`}
                    className="font-mono text-primary hover:underline"
                  >
                    {orden.folio}
                  </Link>
                ) : (
                  "Sin orden"
                )}
              </Dato>
              <Dato label="Registrado por">{creador?.nombre ?? "—"}</Dato>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fechas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Dato label="Solicitud">{formatFecha(ticket.fechaSolicitud)}</Dato>
            </CardContent>
          </Card>
        </div>
      </div>

      <TicketFormDialog open={editOpen} onOpenChange={setEditOpen} ticket={ticket} />
    </>
  )
}

function Bloque({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="text-sm leading-relaxed text-pretty">{value || "—"}</p>
    </div>
  )
}

function Dato({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

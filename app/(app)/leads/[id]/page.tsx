"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Pencil,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Building2,
  Send,
  FileText,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { LeadFormDialog } from "@/components/leads/lead-form-dialog"
import { CotizacionFormDialog } from "@/components/cotizaciones/cotizacion-form-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { TIPOS_ACTIVIDAD_LEAD, type TipoActividadLead } from "@/lib/types"
import {
  estadoLeadVariant,
  prioridadLeadVariant,
  formatMoneda,
  formatFecha,
  formatFechaHora,
} from "@/lib/format"

export default function LeadDetallePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const {
    leads,
    leadActividades,
    campanas,
    usuarios,
    clientes,
    registrarActividadLead,
    convertirLeadEnCliente,
  } = useStore()

  const lead = leads.find((l) => l.id === params.id)

  const [editOpen, setEditOpen] = React.useState(false)
  const [cotizacionOpen, setCotizacionOpen] = React.useState(false)
  const [tipo, setTipo] = React.useState<TipoActividadLead>("Llamada")
  const [descripcion, setDescripcion] = React.useState("")
  const [enviando, setEnviando] = React.useState(false)

  if (!lead) {
    return (
      <>
        <PageHeader title="Lead no encontrado" />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserCheck />
            </EmptyMedia>
            <EmptyTitle>Este lead no existe</EmptyTitle>
            <EmptyDescription>
              Es posible que haya sido eliminado.{" "}
              <Link href="/leads" className="text-primary hover:underline">
                Volver a leads
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    )
  }

  const actividades = leadActividades
    .filter((a) => a.leadId === lead.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const campana = lead.campanaId ? campanas.find((c) => c.id === lead.campanaId) : null
  const responsable = lead.asignadoA ? usuarios.find((u) => u.id === lead.asignadoA) : null
  const clienteVinculado = lead.clienteId
    ? clientes.find((c) => c.id === lead.clienteId)
    : null

  const nombreUsuario = (id: string | null) =>
    id ? (usuarios.find((u) => u.id === id)?.nombre ?? "Sistema") : "Sistema"

  const handleRegistrar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descripcion.trim()) return
    setEnviando(true)
    await registrarActividadLead(lead.id, tipo, descripcion.trim())
    setDescripcion("")
    setEnviando(false)
  }

  return (
    <>
      <PageHeader
        title={lead.nombre || lead.empresa || "Lead"}
        description={lead.empresa && lead.nombre ? lead.empresa : lead.servicioInteres}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/leads" />} nativeButton={false}>
              <ArrowLeft data-icon="inline-start" />
              Volver
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
            {clienteVinculado ? (
              <>
                <Button variant="outline" onClick={() => setCotizacionOpen(true)}>
                  <FileText data-icon="inline-start" />
                  Crear cotización
                </Button>
                <Button
                  variant="secondary"
                  render={<Link href={`/clientes/${clienteVinculado.id}`} />}
                  nativeButton={false}
                >
                  <Building2 data-icon="inline-start" />
                  Ver cliente
                </Button>
              </>
            ) : (
              <Button onClick={() => convertirLeadEnCliente(lead)}>
                <UserCheck data-icon="inline-start" />
                Convertir en cliente
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Información del prospecto</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={estadoLeadVariant(lead.estado)}>{lead.estado}</Badge>
                <Badge variant={prioridadLeadVariant(lead.prioridad)}>
                  Prioridad {lead.prioridad}
                </Badge>
                {clienteVinculado && <Badge variant="success">Cliente</Badge>}
              </div>

              {lead.telefono && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  <span className="text-foreground">{lead.telefono}</span>
                </div>
              )}
              {lead.correo && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4 shrink-0" />
                  <span className="truncate text-foreground">{lead.correo}</span>
                </div>
              )}
              {lead.ciudad && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  <span className="text-foreground">{lead.ciudad}</span>
                </div>
              )}

              <dl className="flex flex-col gap-2 border-t border-border pt-3">
                <Dato label="Servicio de interés" valor={lead.servicioInteres} />
                <Dato label="Valor estimado" valor={lead.valorEstimado != null ? formatMoneda(lead.valorEstimado) : "—"} />
                <Dato label="Responsable" valor={responsable?.nombre ?? "Sin asignar"} />
                <Dato label="Próximo contacto" valor={formatFecha(lead.proximoContacto)} />
                <Dato label="Último contacto" valor={formatFechaHora(lead.ultimoContacto)} />
                <Dato label="Registrado" valor={formatFechaHora(lead.createdAt)} />
              </dl>

              {lead.descripcionNecesidad && (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Necesidad</p>
                  <p className="text-sm">{lead.descripcionNecesidad}</p>
                </div>
              )}
              {lead.notas && (
                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notas</p>
                  <p className="text-sm">{lead.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atribución</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                <Dato label="Origen" valor={lead.origen} />
                <Dato label="Medio" valor={lead.medio} />
                <Dato label="Campaña" valor={campana?.nombre ?? "—"} />
                <Dato label="UTM source" valor={lead.utmSource} />
                <Dato label="UTM medium" valor={lead.utmMedium} />
                <Dato label="UTM campaign" valor={lead.utmCampaign} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Bitácora de seguimiento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form
                onSubmit={handleRegistrar}
                className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Field className="sm:w-48">
                    <FieldLabel htmlFor="tipo-act">Tipo de interacción</FieldLabel>
                    <Select
                      value={tipo}
                      onValueChange={(v) => setTipo((v as TipoActividadLead) ?? "Nota")}
                    >
                      <SelectTrigger id="tipo-act" className="w-full">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_ACTIVIDAD_LEAD.filter((t) => t !== "Cambio de estado").map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="flex-1">
                    <FieldLabel htmlFor="desc-act">Detalle</FieldLabel>
                    <Textarea
                      id="desc-act"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={2}
                      placeholder="Se contactó al prospecto para agendar visita técnica…"
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={enviando || !descripcion.trim()}>
                    <Send data-icon="inline-start" />
                    Registrar
                  </Button>
                </div>
              </form>

              {actividades.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aún no hay actividades registradas.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {actividades.map((a) => (
                    <li key={a.id} className="flex gap-3">
                      <div className="mt-1 flex flex-col items-center">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="mt-1 w-px flex-1 bg-border" />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{a.tipo}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatFechaHora(a.createdAt)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            · {nombreUsuario(a.usuarioId)}
                          </span>
                        </div>
                        {a.descripcion && <p className="mt-1 text-sm">{a.descripcion}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LeadFormDialog open={editOpen} onOpenChange={setEditOpen} lead={lead} />
      {clienteVinculado && (
        <CotizacionFormDialog
          open={cotizacionOpen}
          onOpenChange={setCotizacionOpen}
          prefill={{
            clienteId: clienteVinculado.id,
            contacto: lead.nombre || clienteVinculado.contacto || "",
            leadId: lead.id,
            observaciones: lead.descripcionNecesidad
              ? `Solicitud del prospecto: ${lead.descripcionNecesidad}`
              : "",
          }}
        />
      )}
    </>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{valor || "—"}</dd>
    </div>
  )
}

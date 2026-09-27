"use client"

import * as React from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  LayoutGrid,
  List,
  Phone,
  Mail,
  Users,
  Filter,
  Wallet,
  Target,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { LeadFormDialog } from "@/components/leads/lead-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import {
  ESTADOS_LEAD,
  ETAPAS_PIPELINE,
  ORIGENES_LEAD,
  type EstadoLead,
  type Lead,
} from "@/lib/types"
import {
  estadoLeadVariant,
  prioridadLeadVariant,
  formatMoneda,
  formatFecha,
} from "@/lib/format"

const TODOS = "__todos__"

export default function LeadsPage() {
  const { leads, campanas, actualizarLead, eliminarLead } = useStore()
  const [query, setQuery] = React.useState("")
  const [filtroOrigen, setFiltroOrigen] = React.useState<string>(TODOS)
  const [vista, setVista] = React.useState<"kanban" | "lista">("kanban")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Lead | null>(null)
  const [deleting, setDeleting] = React.useState<Lead | null>(null)

  const filtrados = leads.filter((l) => {
    const q = query.toLowerCase()
    const coincideTexto =
      l.nombre.toLowerCase().includes(q) ||
      l.empresa.toLowerCase().includes(q) ||
      l.telefono.toLowerCase().includes(q) ||
      l.correo.toLowerCase().includes(q) ||
      l.servicioInteres.toLowerCase().includes(q)
    const coincideOrigen = filtroOrigen === TODOS || l.origen === filtroOrigen
    return coincideTexto && coincideOrigen
  })

  const abiertos = leads.filter((l) => l.estado !== "Ganado" && l.estado !== "Perdido")
  const ganados = leads.filter((l) => l.estado === "Ganado")
  const valorPipeline = abiertos.reduce((sum, l) => sum + (l.valorEstimado ?? 0), 0)
  const tasaConversion =
    leads.length > 0 ? Math.round((ganados.length / leads.length) * 100) : 0

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (lead: Lead) => {
    setEditing(lead)
    setDialogOpen(true)
  }

  const nombreCampana = (id: string | null) =>
    id ? (campanas.find((c) => c.id === id)?.nombre ?? "—") : "—"

  return (
    <>
      <PageHeader
        title="Leads"
        description="Captura y da seguimiento a los prospectos generados por marketing."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nuevo lead
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Leads totales" value={leads.length} icon={Users} />
        <StatCard label="En pipeline" value={abiertos.length} icon={Filter} accent="info" />
        <StatCard label="Valor estimado" value={formatMoneda(valorPipeline)} icon={Wallet} accent="success" />
        <StatCard label="Conversión" value={`${tasaConversion}%`} icon={Target} accent="warning" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, empresa, contacto…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filtroOrigen} onValueChange={(v) => setFiltroOrigen((v as string) ?? TODOS)}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos los orígenes</SelectItem>
                  {ORIGENES_LEAD.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              <Button
                variant={vista === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setVista("kanban")}
              >
                <LayoutGrid data-icon="inline-start" />
                Tablero
              </Button>
              <Button
                variant={vista === "lista" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setVista("lista")}
              >
                <List data-icon="inline-start" />
                Lista
              </Button>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UserPlus />
                </EmptyMedia>
                <EmptyTitle>Sin leads</EmptyTitle>
                <EmptyDescription>
                  No hay prospectos que coincidan con la búsqueda. Registra el primero.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : vista === "kanban" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {ETAPAS_PIPELINE.map((etapa) => {
                const items = filtrados.filter((l) => l.estado === etapa)
                const total = items.reduce((s, l) => s + (l.valorEstimado ?? 0), 0)
                return (
                  <div
                    key={etapa}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
                  >
                    <div className="flex items-center justify-between px-1">
                      <Badge variant={estadoLeadVariant(etapa)}>{etapa}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((l) => (
                        <LeadCard
                          key={l.id}
                          lead={l}
                          campana={nombreCampana(l.campanaId)}
                          onMover={(estado) => actualizarLead(l.id, { estado })}
                        />
                      ))}
                      {items.length === 0 && (
                        <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                          Sin leads
                        </p>
                      )}
                    </div>
                    {total > 0 && (
                      <p className="border-t border-border px-1 pt-1.5 text-xs tabular-nums text-muted-foreground">
                        {formatMoneda(total)}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contacto</TableHead>
                    <TableHead className="hidden md:table-cell">Servicio</TableHead>
                    <TableHead className="hidden lg:table-cell">Origen</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="hidden sm:table-cell">Prioridad</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Valor est.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Link
                          href={`/leads/${l.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {l.nombre || l.empresa || "Sin nombre"}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {l.empresa && l.nombre ? l.empresa : l.telefono || l.correo}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {l.servicioInteres || "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{l.origen || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={estadoLeadVariant(l.estado)}>{l.estado}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={prioridadLeadVariant(l.prioridad)}>{l.prioridad}</Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right tabular-nums">
                        {l.valorEstimado != null ? formatMoneda(l.valorEstimado) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/leads/${l.id}`} />}
                            nativeButton={false}
                            aria-label="Ver lead"
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditar(l)}
                            aria-label="Editar lead"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(l)}
                            aria-label="Eliminar lead"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadFormDialog open={dialogOpen} onOpenChange={setDialogOpen} lead={editing} />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar lead?"
        description={
          <>
            Se eliminará <strong>{deleting?.nombre || deleting?.empresa}</strong> y su bitácora
            de actividades. Esta acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarLead(deleting.id)
        }}
      />
    </>
  )
}

function LeadCard({
  lead,
  campana,
  onMover,
}: {
  lead: Lead
  campana: string
  onMover: (estado: EstadoLead) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2.5 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/leads/${lead.id}`}
          className="text-sm font-medium leading-tight text-foreground hover:text-primary hover:underline"
        >
          {lead.nombre || lead.empresa || "Sin nombre"}
        </Link>
        <Badge variant={prioridadLeadVariant(lead.prioridad)} className="shrink-0">
          {lead.prioridad}
        </Badge>
      </div>
      {lead.empresa && lead.nombre && (
        <p className="text-xs text-muted-foreground">{lead.empresa}</p>
      )}
      {lead.servicioInteres && (
        <p className="text-xs text-muted-foreground">{lead.servicioInteres}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {lead.telefono && (
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3" />
            {lead.telefono}
          </span>
        )}
        {lead.correo && (
          <span className="inline-flex items-center gap-1 truncate">
            <Mail className="size-3" />
            {lead.correo}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{campana}</span>
        {lead.valorEstimado != null && (
          <span className="shrink-0 text-xs font-medium tabular-nums">
            {formatMoneda(lead.valorEstimado)}
          </span>
        )}
      </div>
      <Select value={lead.estado} onValueChange={(v) => onMover(v as EstadoLead)}>
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="Mover etapa" />
        </SelectTrigger>
        <SelectContent>
          {ESTADOS_LEAD.map((e) => (
            <SelectItem key={e} value={e}>
              {e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {lead.proximoContacto && (
        <p className="text-xs text-muted-foreground">
          Próximo contacto: {formatFecha(lead.proximoContacto)}
        </p>
      )}
    </div>
  )
}

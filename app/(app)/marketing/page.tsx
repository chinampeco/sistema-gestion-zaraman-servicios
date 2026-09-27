"use client"

import * as React from "react"
import { Plus, Search, Pencil, Trash2, Megaphone, Wallet, Users, Coins } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { CampanaFormDialog } from "@/components/marketing/campana-form-dialog"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { StatCard } from "@/components/stat-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import type { MarketingCampana } from "@/lib/types"
import { formatMoneda, formatFecha } from "@/lib/format"

export default function MarketingPage() {
  const { campanas, leads, eliminarCampana } = useStore()
  const [query, setQuery] = React.useState("")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MarketingCampana | null>(null)
  const [deleting, setDeleting] = React.useState<MarketingCampana | null>(null)

  const filtradas = campanas.filter((c) => {
    const q = query.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.plataforma.toLowerCase().includes(q) ||
      c.servicio.toLowerCase().includes(q)
    )
  })

  const leadsPorCampana = (id: string) => leads.filter((l) => l.campanaId === id)

  const inversionTotal = campanas.reduce((s, c) => s + c.gastoReal, 0)
  const leadsAtribuidos = leads.filter((l) => l.campanaId).length
  const activas = campanas.filter((c) => c.activa).length
  const costoPorLead =
    leadsAtribuidos > 0 ? inversionTotal / leadsAtribuidos : 0

  const openNuevo = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEditar = (campana: MarketingCampana) => {
    setEditing(campana)
    setDialogOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Campañas de marketing"
        description="Mide la inversión publicitaria y su retorno en leads y clientes."
        actions={
          <Button onClick={openNuevo}>
            <Plus data-icon="inline-start" />
            Nueva campaña
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Campañas activas" value={activas} icon={Megaphone} />
        <StatCard label="Inversión total" value={formatMoneda(inversionTotal)} icon={Wallet} accent="info" />
        <StatCard label="Leads atribuidos" value={leadsAtribuidos} icon={Users} accent="success" />
        <StatCard label="Costo por lead" value={formatMoneda(costoPorLead)} icon={Coins} accent="warning" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, plataforma o servicio…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {filtradas.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Megaphone />
                </EmptyMedia>
                <EmptyTitle>Sin campañas</EmptyTitle>
                <EmptyDescription>
                  Registra tu primera campaña para dar seguimiento a la inversión y sus
                  resultados.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaña</TableHead>
                    <TableHead className="hidden md:table-cell">Plataforma</TableHead>
                    <TableHead className="hidden lg:table-cell">Periodo</TableHead>
                    <TableHead className="text-right">Presupuesto</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Gasto</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="hidden xl:table-cell text-right">Costo/lead</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => {
                    const nLeads = leadsPorCampana(c.id).length
                    const cpl = nLeads > 0 ? c.gastoReal / nLeads : 0
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nombre}</div>
                          {c.servicio && (
                            <div className="text-xs text-muted-foreground">{c.servicio}</div>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {c.plataforma || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {formatFecha(c.fechaInicio)} — {formatFecha(c.fechaFin)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoneda(c.presupuesto)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-right tabular-nums">
                          {formatMoneda(c.gastoReal)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">{nLeads}</TableCell>
                        <TableCell className="hidden xl:table-cell text-right tabular-nums">
                          {nLeads > 0 ? formatMoneda(cpl) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={c.activa ? "success" : "secondary"}>
                            {c.activa ? "Activa" : "Pausada"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEditar(c)}
                              aria-label="Editar campaña"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(c)}
                              aria-label="Eliminar campaña"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
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

      <CampanaFormDialog open={dialogOpen} onOpenChange={setDialogOpen} campana={editing} />

      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar campaña?"
        description={
          <>
            Se eliminará <strong>{deleting?.nombre}</strong>. Los leads asociados conservarán su
            registro pero quedarán sin campaña. Esta acción no se puede deshacer.
          </>
        }
        onConfirm={async () => {
          if (!deleting) return false
          return eliminarCampana(deleting.id)
        }}
      />
    </>
  )
}

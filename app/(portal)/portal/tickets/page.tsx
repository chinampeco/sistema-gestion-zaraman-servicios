"use client"

import * as React from "react"
import { Plus, Ticket as TicketIcon } from "lucide-react"

import { useStore } from "@/lib/store"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EstadoTicketBadge, PrioridadTicketBadge } from "@/components/status-badges"
import { formatFecha } from "@/lib/format"
import { PortalTicketDialog } from "@/components/portal/portal-ticket-dialog"
import type { Ticket } from "@/lib/types"

export default function PortalTicketsPage() {
  const { tickets, equipos, cargando } = useStore()
  const [abrir, setAbrir] = React.useState(false)

  const lista = [...tickets].sort((a, b) => (b.fechaSolicitud ?? "").localeCompare(a.fechaSolicitud ?? ""))
  const equipoTexto = (t: Ticket) => {
    const e = equipos.find((eq) => eq.id === t.equipoId)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}` : "General"
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis tickets</h1>
          <p className="text-sm text-muted-foreground">Solicita un nuevo servicio y da seguimiento a tus tickets.</p>
        </div>
        <Button onClick={() => setAbrir(true)}>
          <Plus />
          Nuevo ticket
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead className="hidden sm:table-cell">Equipo</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {cargando ? "Cargando…" : "Aún no tienes tickets. Crea uno con el botón «Nuevo ticket»."}
                  </TableCell>
                </TableRow>
              ) : (
                lista.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.folio}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">{equipoTexto(t)}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{equipoTexto(t)}</TableCell>
                    <TableCell className="hidden md:table-cell">{t.tipoServicio}</TableCell>
                    <TableCell>
                      <PrioridadTicketBadge prioridad={t.prioridad} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{formatFecha(t.fechaSolicitud)}</TableCell>
                    <TableCell>
                      <EstadoTicketBadge estado={t.estado} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PortalTicketDialog open={abrir} onOpenChange={setAbrir} />
    </div>
  )
}

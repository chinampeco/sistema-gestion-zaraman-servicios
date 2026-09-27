"use client"

import * as React from "react"

import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PRIORIDADES_TICKET, TIPOS_SERVICIO } from "@/lib/types"
import type { PrioridadTicket, TipoServicio } from "@/lib/types"

const SIN_EQUIPO = "sin-equipo"

export function PortalTicketDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { usuarioActual, clientes, equipos, crearTicket } = useStore()
  const cliente = clientes.find((c) => c.id === usuarioActual.clienteId) ?? null

  const [tipoServicio, setTipoServicio] = React.useState<TipoServicio>("Correctivo")
  const [prioridad, setPrioridad] = React.useState<PrioridadTicket>("Normal")
  const [equipoId, setEquipoId] = React.useState<string>(SIN_EQUIPO)
  const [asunto, setAsunto] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setTipoServicio("Correctivo")
      setPrioridad("Normal")
      setEquipoId(SIN_EQUIPO)
      setAsunto("")
      setDescripcion("")
    }
  }, [open])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente) return
    setGuardando(true)
    const asuntoLimpio = asunto.trim()
    const descripcionLimpia = descripcion.trim()
    const descripcionFalla = asuntoLimpio
      ? `${asuntoLimpio}\n\n${descripcionLimpia}`.trim()
      : descripcionLimpia
    const creado = await crearTicket({
      clienteId: cliente.id,
      equipoId: equipoId === SIN_EQUIPO ? null : equipoId,
      ordenId: null,
      tipoServicio,
      prioridad,
      estado: "Nuevo",
      descripcionFalla,
      contacto: cliente.telefono || cliente.email || "",
      ubicacion: cliente.direccion || "",
      fechaSolicitud: new Date().toISOString().slice(0, 10),
      creadoPor: usuarioActual.id,
    })
    setGuardando(false)
    if (creado) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo ticket de servicio</DialogTitle>
          <DialogDescription>Describe tu solicitud y nuestro equipo le dará seguimiento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="tipo">Tipo de servicio</Label>
              <Select value={tipoServicio} onValueChange={(v) => setTipoServicio(v as TipoServicio)}>
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_SERVICIO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="prioridad">Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as PrioridadTicket)}>
                <SelectTrigger id="prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES_TICKET.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="equipo">Equipo relacionado</Label>
            <Select value={equipoId} onValueChange={setEquipoId}>
              <SelectTrigger id="equipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_EQUIPO}>Sin equipo específico</SelectItem>
                {equipos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.tipo} · {e.marca} {e.modelo}
                    {e.numeroSerie ? ` (${e.numeroSerie})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="asunto">Asunto</Label>
            <Input
              id="asunto"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej. El equipo no enfría"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="descripcion">Descripción del problema</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe con detalle lo que ocurre…"
              rows={4}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !cliente}>
              {guardando ? "Enviando…" : "Enviar ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

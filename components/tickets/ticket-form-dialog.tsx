"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { hoyISO } from "@/lib/format"
import {
  ESTADOS_TICKET,
  PRIORIDADES_TICKET,
  TIPOS_SERVICIO,
  type EstadoTicket,
  type PrioridadTicket,
  type Ticket,
  type TipoServicio,
} from "@/lib/types"

interface TicketFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket?: Ticket | null
}

type FormState = Omit<Ticket, "id" | "folio">

function emptyForm(creadoPor: string): FormState {
  return {
    clienteId: "",
    equipoId: null,
    contacto: "",
    ubicacion: "",
    tipoServicio: "Correctivo",
    prioridad: "Normal",
    estado: "Nuevo",
    descripcionFalla: "",
    fechaSolicitud: hoyISO(),
    ordenId: null,
    creadoPor,
  }
}

export function TicketFormDialog({
  open,
  onOpenChange,
  ticket,
}: TicketFormDialogProps) {
  const { clientes, equipos, usuarioActual, crearTicket, actualizarTicket } =
    useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm(usuarioActual.id))

  React.useEffect(() => {
    if (open) {
      setForm(
        ticket
          ? {
              clienteId: ticket.clienteId,
              equipoId: ticket.equipoId,
              contacto: ticket.contacto,
              ubicacion: ticket.ubicacion,
              tipoServicio: ticket.tipoServicio,
              prioridad: ticket.prioridad,
              estado: ticket.estado,
              descripcionFalla: ticket.descripcionFalla,
              fechaSolicitud: ticket.fechaSolicitud,
              ordenId: ticket.ordenId,
              creadoPor: ticket.creadoPor,
            }
          : emptyForm(usuarioActual.id)
      )
    }
  }, [open, ticket, usuarioActual.id])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const equiposCliente = React.useMemo(() => {
    const lista = equipos.filter((e) => e.clienteId === form.clienteId)
    if (form.equipoId && !lista.some((e) => e.id === form.equipoId)) {
      const actual = equipos.find((e) => e.id === form.equipoId)
      if (actual) lista.push(actual)
    }
    return lista
  }, [equipos, form.clienteId, form.equipoId])

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find((c) => c.id === clienteId)
    setForm((prev) => ({
      ...prev,
      clienteId,
      equipoId: null,
      contacto: prev.contacto || cliente?.contacto || "",
      ubicacion: prev.ubicacion || cliente?.direccion || "",
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) {
      toast.error("Selecciona un cliente.")
      return
    }
    if (!form.descripcionFalla.trim()) {
      toast.error("Describe el motivo del ticket.")
      return
    }
    const payload: FormState = {
      ...form,
      equipoId: form.equipoId || null,
    }
    if (ticket) {
      actualizarTicket(ticket.id, payload)
    } else {
      crearTicket(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {ticket ? `Editar ticket ${ticket.folio}` : "Nuevo ticket"}
            </DialogTitle>
            <DialogDescription>
              {ticket
                ? "Actualiza los datos de la solicitud."
                : "Registra una solicitud de servicio. El folio se genera automáticamente al guardar."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Select value={form.clienteId} onValueChange={handleClienteChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Equipo (opcional)</FieldLabel>
                <Select
                  value={form.equipoId ?? ""}
                  onValueChange={(v) => set("equipoId", (v as string) || null)}
                  disabled={!form.clienteId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        form.clienteId
                          ? "Selecciona un equipo"
                          : "Primero elige un cliente"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {equiposCliente.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.tipo} · {e.marca} {e.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="t-contacto">Contacto</FieldLabel>
                <Input
                  id="t-contacto"
                  value={form.contacto}
                  onChange={(e) => set("contacto", e.target.value)}
                  placeholder="Persona que reporta"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="t-ubicacion">Ubicación</FieldLabel>
                <Input
                  id="t-ubicacion"
                  value={form.ubicacion}
                  onChange={(e) => set("ubicacion", e.target.value)}
                  placeholder="Sitio o área del servicio"
                />
              </Field>

              <Field>
                <FieldLabel>Tipo de servicio</FieldLabel>
                <Select
                  value={form.tipoServicio}
                  onValueChange={(v) =>
                    set("tipoServicio", (v as TipoServicio) ?? "Correctivo")
                  }
                >
                  <SelectTrigger className="w-full">
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
              </Field>
              <Field>
                <FieldLabel>Prioridad</FieldLabel>
                <Select
                  value={form.prioridad}
                  onValueChange={(v) =>
                    set("prioridad", (v as PrioridadTicket) ?? "Normal")
                  }
                >
                  <SelectTrigger className="w-full">
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
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select
                  value={form.estado}
                  onValueChange={(v) =>
                    set("estado", (v as EstadoTicket) ?? "Nuevo")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_TICKET.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="t-solicitud">Fecha de solicitud</FieldLabel>
                <Input
                  id="t-solicitud"
                  type="date"
                  value={form.fechaSolicitud}
                  onChange={(e) => set("fechaSolicitud", e.target.value)}
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="t-falla">Motivo / descripción</FieldLabel>
                <Textarea
                  id="t-falla"
                  value={form.descripcionFalla}
                  onChange={(e) => set("descripcionFalla", e.target.value)}
                  rows={3}
                  placeholder="Describe el problema o la solicitud de servicio"
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {ticket ? "Guardar cambios" : "Crear ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

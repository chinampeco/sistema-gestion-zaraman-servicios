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
import {
  ESTADOS_LEAD,
  ORIGENES_LEAD,
  PRIORIDADES_LEAD,
  type EstadoLead,
  type Lead,
  type PrioridadLead,
} from "@/lib/types"

const SIN_CAMPANA = "__sin_campana__"
const SIN_ASIGNAR = "__sin_asignar__"

interface LeadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead | null
}

type FormState = Omit<Lead, "id" | "createdAt" | "clienteId" | "creadoPor">

function emptyForm(): FormState {
  return {
    nombre: "",
    empresa: "",
    telefono: "",
    correo: "",
    ciudad: "",
    servicioInteres: "",
    descripcionNecesidad: "",
    origen: "Facebook",
    medio: "",
    campanaId: null,
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    estado: "Nuevo",
    prioridad: "Normal",
    asignadoA: null,
    valorEstimado: null,
    valorCerrado: null,
    ultimoContacto: null,
    proximoContacto: null,
    notas: "",
  }
}

export function LeadFormDialog({ open, onOpenChange, lead }: LeadFormDialogProps) {
  const { crearLead, actualizarLead, campanas, usuarios } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm())

  // Solo staff interno (no técnicos ni clientes) puede recibir leads asignados.
  const asignables = React.useMemo(() => {
    const disponibles = usuarios.filter(
      (u) => u.activo && u.rol !== "tecnico" && u.rol !== "cliente",
    )
    // Siempre incluimos al responsable actualmente guardado, aunque haya sido
    // desactivado o cambiado de rol; así el Select puede resolver el nombre
    // y nunca mostrar el UUID como texto.
    if (form.asignadoA && !disponibles.some((u) => u.id === form.asignadoA)) {
      const actual = usuarios.find((u) => u.id === form.asignadoA)
      if (actual) disponibles.push(actual)
    }
    return disponibles
  }, [usuarios, form.asignadoA])

  React.useEffect(() => {
    if (open) {
      setForm(
        lead
          ? {
              nombre: lead.nombre,
              empresa: lead.empresa,
              telefono: lead.telefono,
              correo: lead.correo,
              ciudad: lead.ciudad,
              servicioInteres: lead.servicioInteres,
              descripcionNecesidad: lead.descripcionNecesidad,
              origen: lead.origen,
              medio: lead.medio,
              campanaId: lead.campanaId,
              utmSource: lead.utmSource,
              utmMedium: lead.utmMedium,
              utmCampaign: lead.utmCampaign,
              utmContent: lead.utmContent,
              utmTerm: lead.utmTerm,
              estado: lead.estado,
              prioridad: lead.prioridad,
              asignadoA: lead.asignadoA,
              valorEstimado: lead.valorEstimado,
              valorCerrado: lead.valorCerrado,
              ultimoContacto: lead.ultimoContacto,
              proximoContacto: lead.proximoContacto,
              notas: lead.notas,
            }
          : emptyForm(),
      )
    }
  }, [open, lead])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() && !form.empresa.trim()) {
      toast.error("Captura al menos el nombre del contacto o la empresa.")
      return
    }
    if (!form.telefono.trim() && !form.correo.trim()) {
      toast.error("Captura al menos un teléfono o correo de contacto.")
      return
    }
    const payload: FormState = {
      ...form,
      valorEstimado:
        form.valorEstimado === null || Number.isNaN(Number(form.valorEstimado))
          ? null
          : Number(form.valorEstimado),
      proximoContacto: form.proximoContacto || null,
    }
    if (lead) {
      await actualizarLead(lead.id, payload)
    } else {
      await crearLead({ ...payload, clienteId: null, creadoPor: null })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{lead ? "Editar lead" : "Nuevo lead"}</DialogTitle>
            <DialogDescription>
              {lead
                ? "Actualiza la información y el seguimiento del prospecto."
                : "Registra un prospecto y da seguimiento a su interés comercial."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nombre-lead">Nombre del contacto</FieldLabel>
                <Input
                  id="nombre-lead"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Juan Pérez"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="empresa-lead">Empresa</FieldLabel>
                <Input
                  id="empresa-lead"
                  value={form.empresa}
                  onChange={(e) => set("empresa", e.target.value)}
                  placeholder="Industrias del Norte"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono-lead">Teléfono</FieldLabel>
                <Input
                  id="telefono-lead"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="correo-lead">Correo</FieldLabel>
                <Input
                  id="correo-lead"
                  type="email"
                  value={form.correo}
                  onChange={(e) => set("correo", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ciudad-lead">Ciudad</FieldLabel>
                <Input
                  id="ciudad-lead"
                  value={form.ciudad}
                  onChange={(e) => set("ciudad", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="servicio-lead">Servicio de interés</FieldLabel>
                <Input
                  id="servicio-lead"
                  value={form.servicioInteres}
                  onChange={(e) => set("servicioInteres", e.target.value)}
                  placeholder="Mantenimiento de compresor"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="necesidad-lead">Descripción de la necesidad</FieldLabel>
                <Textarea
                  id="necesidad-lead"
                  value={form.descripcionNecesidad}
                  onChange={(e) => set("descripcionNecesidad", e.target.value)}
                  rows={2}
                />
              </Field>

              <Field>
                <FieldLabel>Origen</FieldLabel>
                <Select
                  value={form.origen}
                  onValueChange={(v) => set("origen", (v as string) ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENES_LEAD.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Campaña</FieldLabel>
                <Select
                  value={form.campanaId ?? SIN_CAMPANA}
                  onValueChange={(v) =>
                    set("campanaId", v === SIN_CAMPANA ? null : ((v as string) ?? null))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin campaña" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_CAMPANA}>Sin campaña</SelectItem>
                    {campanas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select
                  value={form.estado}
                  onValueChange={(v) => set("estado", (v as EstadoLead) ?? "Nuevo")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_LEAD.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Prioridad</FieldLabel>
                <Select
                  value={form.prioridad}
                  onValueChange={(v) => set("prioridad", (v as PrioridadLead) ?? "Normal")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES_LEAD.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Responsable</FieldLabel>
                <Select
                  value={form.asignadoA ?? SIN_ASIGNAR}
                  onValueChange={(v) =>
                    set("asignadoA", v === SIN_ASIGNAR ? null : ((v as string) ?? null))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                    {asignables.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="valor-lead">Valor estimado (MXN)</FieldLabel>
                <Input
                  id="valor-lead"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valorEstimado ?? ""}
                  onChange={(e) =>
                    set("valorEstimado", e.target.value === "" ? null : Number(e.target.value))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proximo-lead">Próximo contacto</FieldLabel>
                <Input
                  id="proximo-lead"
                  type="date"
                  value={form.proximoContacto ?? ""}
                  onChange={(e) => set("proximoContacto", e.target.value || null)}
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notas-lead">Notas</FieldLabel>
                <Textarea
                  id="notas-lead"
                  value={form.notas}
                  onChange={(e) => set("notas", e.target.value)}
                  rows={3}
                />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{lead ? "Guardar cambios" : "Crear lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

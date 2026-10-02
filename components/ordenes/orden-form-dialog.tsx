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
  ESTADOS_ORDEN,
  PRIORIDADES,
  TIPOS_SERVICIO,
  type EstadoOrden,
  type OrdenServicio,
  type Prioridad,
  type TipoServicio,
} from "@/lib/types"

interface OrdenFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orden?: OrdenServicio | null
}

type FormState = Omit<OrdenServicio, "id" | "folio">

function emptyForm(creadoPor: string): FormState {
  return {
    clienteId: "",
    equipoId: "",
    fechaSolicitud: hoyISO(),
    fechaProgramada: null,
    horaProgramada: null,
    fechaInicio: null,
    fechaCierre: null,
    tipoServicio: "Preventivo",
    prioridad: "Normal",
    estado: "Pendiente",
    descripcionFalla: "",
    diagnostico: "",
    trabajoRealizado: "",
    tecnicoId: null,
    materiales: "",
    materialesDetalle: [],
    evidencias: [],
    horasTrabajadas: null,
    observaciones: "",
    firmaCliente: "",
    firmaFecha: null,
    cerradaPor: null,
    creadoPor,
    ticketId: null,
    historial: [],
  }
}

export function OrdenFormDialog({
  open,
  onOpenChange,
  orden,
}: OrdenFormDialogProps) {
  const {
    clientes,
    equipos,
    usuarioActual,
    crearOrden,
    actualizarOrden,
  } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm(usuarioActual.nombre))

  React.useEffect(() => {
    if (!open) return

    setForm(
      orden
        ? {
            clienteId: orden.clienteId,
            equipoId: orden.equipoId,
            fechaSolicitud: orden.fechaSolicitud,
            fechaProgramada: orden.fechaProgramada,
            horaProgramada: orden.horaProgramada,
            fechaInicio: orden.fechaInicio,
            fechaCierre: orden.fechaCierre,
            tipoServicio: orden.tipoServicio,
            prioridad: orden.prioridad,
            estado: orden.estado,
            descripcionFalla: orden.descripcionFalla,
            diagnostico: orden.diagnostico,
            trabajoRealizado: orden.trabajoRealizado,
            tecnicoId: orden.tecnicoId,
            materiales: orden.materiales,
            materialesDetalle: orden.materialesDetalle,
            evidencias: orden.evidencias,
            horasTrabajadas: orden.horasTrabajadas,
            observaciones: orden.observaciones,
            firmaCliente: orden.firmaCliente,
            firmaFecha: orden.firmaFecha,
            cerradaPor: orden.cerradaPor,
            creadoPor: orden.creadoPor,
            ticketId: orden.ticketId,
            historial: orden.historial,
          }
        : emptyForm(usuarioActual.nombre),
    )
  }, [open, orden, usuarioActual.nombre])

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

  const clienteSelectItems = React.useMemo(
    () => clientes.map((c) => ({ value: c.id, label: c.nombre })),
    [clientes],
  )

  const equipoSelectItems = React.useMemo(
    () =>
      equiposCliente.map((e) => ({
        value: e.id,
        label: `${e.tipo} · ${e.marca} ${e.modelo}`.trim(),
      })),
    [equiposCliente],
  )

  const handleClienteChange = (clienteId: string) => {
    setForm((prev) => ({ ...prev, clienteId, equipoId: "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) {
      toast.error("Selecciona un cliente.")
      return
    }
    if (!form.equipoId) {
      toast.error("Selecciona un equipo.")
      return
    }
    if (!form.descripcionFalla.trim()) {
      toast.error("Describe la falla o el motivo del servicio.")
      return
    }

    if (orden) {
      // Los datos operativos del técnico no se envían desde esta ventana.
      // Así, editar la orden administrativa nunca sobrescribe el parte técnico.
      await actualizarOrden(orden.id, {
        clienteId: form.clienteId,
        equipoId: form.equipoId,
        fechaSolicitud: form.fechaSolicitud,
        fechaProgramada: form.fechaProgramada || null,
        horaProgramada: form.horaProgramada || null,
        tipoServicio: form.tipoServicio,
        prioridad: form.prioridad,
        estado: form.estado,
        descripcionFalla: form.descripcionFalla,
      })
      toast.success("Orden actualizada correctamente.")
    } else {
      const payload: FormState = {
        ...form,
        fechaProgramada: form.fechaProgramada || null,
        fechaInicio: null,
        fechaCierre: null,
        tecnicoId: null,
        diagnostico: "",
        trabajoRealizado: "",
        materiales: "",
        materialesDetalle: [],
        evidencias: [],
        horasTrabajadas: null,
        observaciones: "",
        firmaCliente: "",
        firmaFecha: null,
        cerradaPor: null,
      }
      const nueva = await crearOrden(payload)
      if (!nueva) return
      toast.success("Orden de servicio creada correctamente.")
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {orden ? `Editar orden ${orden.folio}` : "Nueva orden de servicio"}
            </DialogTitle>
            <DialogDescription>
              {orden
                ? "Actualiza los datos administrativos de la orden. Los datos capturados por el técnico se muestran solo como consulta."
                : "El folio se genera automáticamente al guardar. El diagnóstico, trabajo, materiales y demás datos operativos los capturará el técnico al iniciar el servicio."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Select value={form.clienteId} onValueChange={handleClienteChange} items={clienteSelectItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Equipo</FieldLabel>
                <Select
                  value={form.equipoId}
                  onValueChange={(v) => set("equipoId", (v as string) ?? "")}
                  disabled={!form.clienteId}
                  items={equipoSelectItems}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder={form.clienteId ? "Selecciona un equipo" : "Primero elige un cliente"} /></SelectTrigger>
                  <SelectContent>
                    {equiposCliente.map((e) => <SelectItem key={e.id} value={e.id}>{e.tipo} · {e.marca} {e.modelo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Tipo de servicio</FieldLabel>
                <Select value={form.tipoServicio} onValueChange={(v) => set("tipoServicio", (v as TipoServicio) ?? "Preventivo")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_SERVICIO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Prioridad</FieldLabel>
                <Select value={form.prioridad} onValueChange={(v) => set("prioridad", (v as Prioridad) ?? "Normal")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select value={form.estado} onValueChange={(v) => set("estado", (v as EstadoOrden) ?? "Pendiente")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADOS_ORDEN.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="f-solicitud">Fecha de solicitud</FieldLabel>
                <Input id="f-solicitud" type="date" value={form.fechaSolicitud} onChange={(e) => set("fechaSolicitud", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-programada">Fecha programada</FieldLabel>
                <Input id="f-programada" type="date" value={form.fechaProgramada ?? ""} onChange={(e) => set("fechaProgramada", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="h-programada">Hora programada</FieldLabel>
                <Input id="h-programada" type="time" value={form.horaProgramada ?? ""} onChange={(e) => set("horaProgramada", e.target.value || null)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-inicio">Fecha de inicio</FieldLabel>
                <Input id="f-inicio" type="date" value={form.fechaInicio ?? ""} disabled className="bg-muted/50" />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-cierre">Fecha de cierre</FieldLabel>
                <Input id="f-cierre" type="date" value={form.fechaCierre ?? ""} disabled className="bg-muted/50" />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="falla">Descripción de la falla</FieldLabel>
                <Textarea id="falla" value={form.descripcionFalla} onChange={(e) => set("descripcionFalla", e.target.value)} rows={2} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="diagnostico">Diagnóstico <span className="text-muted-foreground">(técnico)</span></FieldLabel>
                <Textarea id="diagnostico" value={form.diagnostico} readOnly disabled rows={2} className="bg-muted/50" />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="trabajo">Trabajo realizado <span className="text-muted-foreground">(técnico)</span></FieldLabel>
                <Textarea id="trabajo" value={form.trabajoRealizado} readOnly disabled rows={2} className="bg-muted/50" />
              </Field>
              <Field>
                <FieldLabel htmlFor="materiales">Materiales <span className="text-muted-foreground">(técnico)</span></FieldLabel>
                <Textarea id="materiales" value={form.materiales} readOnly disabled rows={2} className="bg-muted/50" />
              </Field>
              <Field>
                <FieldLabel htmlFor="horas">Horas trabajadas <span className="text-muted-foreground">(técnico)</span></FieldLabel>
                <Input id="horas" type="number" value={form.horasTrabajadas ?? ""} disabled className="bg-muted/50" />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="observaciones">Observaciones <span className="text-muted-foreground">(técnico)</span></FieldLabel>
                <Textarea id="observaciones" value={form.observaciones} readOnly disabled rows={2} className="bg-muted/50" />
              </Field>
            </div>
          </FieldGroup>

          <div className="mb-4 rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">Garantía:</strong> se configura exclusivamente al asignar el técnico desde “Pendientes de asignación”. El técnico solo podrá consultarla durante el servicio.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{orden ? "Guardar cambios" : "Crear orden"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

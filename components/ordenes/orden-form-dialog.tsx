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
import { createClient } from "@/lib/supabase/client"
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

type GarantiaForm = {
  tieneGarantia: boolean
  duracionValor: number | null
  duracionUnidad: "Días" | "Meses" | "Años"
  cobertura: string
  condiciones: string
}

const GARANTIA_DEFAULT: GarantiaForm = {
  tieneGarantia: false,
  duracionValor: null,
  duracionUnidad: "Meses",
  cobertura: "Mano de obra + materiales",
  condiciones: "",
}

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

function sumarGarantia(fechaInicio: string, valor: number, unidad: GarantiaForm["duracionUnidad"]) {
  const fecha = new Date(`${fechaInicio}T00:00:00`)
  if (unidad === "Días") fecha.setDate(fecha.getDate() + valor - 1)
  if (unidad === "Meses") fecha.setMonth(fecha.getMonth() + valor)
  if (unidad === "Años") fecha.setFullYear(fecha.getFullYear() + valor)
  if (unidad !== "Días") fecha.setDate(fecha.getDate() - 1)
  return fecha.toISOString().slice(0, 10)
}

export function OrdenFormDialog({
  open,
  onOpenChange,
  orden,
}: OrdenFormDialogProps) {
  const {
    clientes,
    equipos,
    tecnicos,
    usuarioActual,
    crearOrden,
    actualizarOrden,
  } = useStore()
  const supabase = React.useMemo(() => createClient(), [])
  const [form, setForm] = React.useState<FormState>(emptyForm(usuarioActual.nombre))
  const [garantia, setGarantia] = React.useState<GarantiaForm>(GARANTIA_DEFAULT)

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

    setGarantia(GARANTIA_DEFAULT)
    if (orden) {
      void (async () => {
        const { data } = await supabase
          .from("orden_garantias")
          .select("tiene_garantia, duracion_valor, duracion_unidad, cobertura, condiciones")
          .eq("orden_id", orden.id)
          .maybeSingle()
        if (data) {
          setGarantia({
            tieneGarantia: Boolean(data.tiene_garantia),
            duracionValor: data.duracion_valor == null ? null : Number(data.duracion_valor),
            duracionUnidad: (data.duracion_unidad ?? "Meses") as GarantiaForm["duracionUnidad"],
            cobertura: data.cobertura ?? GARANTIA_DEFAULT.cobertura,
            condiciones: data.condiciones ?? "",
          })
        }
      })()
    }
  }, [open, orden, usuarioActual.nombre, supabase])

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

  const tecnicosDisponibles = React.useMemo(() => {
    const activos = tecnicos.filter((t) => t.activo)
    if (form.tecnicoId && !activos.some((t) => t.id === form.tecnicoId)) {
      const actual = tecnicos.find((t) => t.id === form.tecnicoId)
      if (actual) activos.push(actual)
    }
    return activos
  }, [tecnicos, form.tecnicoId])

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

  const tecnicoSelectItems = React.useMemo(
    () => tecnicosDisponibles.map((t) => ({ value: t.id, label: t.nombre })),
    [tecnicosDisponibles],
  )

  const handleClienteChange = (clienteId: string) => {
    setForm((prev) => ({ ...prev, clienteId, equipoId: "" }))
  }

  const guardarGarantia = async (ordenId: string, fechaCierre: string | null) => {
    const fechaInicio = garantia.tieneGarantia ? fechaCierre || hoyISO() : null
    const fechaFin =
      garantia.tieneGarantia && garantia.duracionValor && fechaInicio
        ? sumarGarantia(fechaInicio, garantia.duracionValor, garantia.duracionUnidad)
        : null

    const { error } = await supabase.from("orden_garantias").upsert(
      {
        orden_id: ordenId,
        orden_origen_id: null,
        tiene_garantia: garantia.tieneGarantia,
        duracion_valor: garantia.tieneGarantia ? garantia.duracionValor : null,
        duracion_unidad: garantia.tieneGarantia ? garantia.duracionUnidad : null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        cobertura: garantia.tieneGarantia ? garantia.cobertura : null,
        condiciones: garantia.tieneGarantia ? garantia.condiciones : null,
        resultado: garantia.tieneGarantia ? "Vigente" : "Pendiente",
      },
      { onConflict: "orden_id" },
    )

    if (error) {
      toast.error("La orden se guardó, pero no se pudo guardar la garantía. Verifica la migración de Supabase.")
    }
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
    if (garantia.tieneGarantia && (!garantia.duracionValor || garantia.duracionValor <= 0)) {
      toast.error("Indica una duración válida para la garantía.")
      return
    }

    const hoy = new Date().toISOString().slice(0, 10)
    const cierreAuto =
      form.estado === "Terminada" ? form.fechaCierre || hoy : form.fechaCierre || null
    const payload: FormState = {
      ...form,
      fechaProgramada: form.fechaProgramada || null,
      fechaInicio: form.fechaInicio || null,
      fechaCierre: cierreAuto,
      tecnicoId: form.tecnicoId || null,
    }

    if (orden) {
      await actualizarOrden(orden.id, payload)
      await guardarGarantia(orden.id, cierreAuto)
      toast.success("Orden actualizada correctamente.")
    } else {
      const nueva = await crearOrden(payload)
      if (nueva) await guardarGarantia(nueva.id, cierreAuto)
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
                ? "Actualiza los datos de la orden de servicio."
                : "El folio se genera automáticamente al guardar."}
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
                <FieldLabel>Técnico responsable</FieldLabel>
                <Select value={form.tecnicoId ?? ""} onValueChange={(v) => set("tecnicoId", (v as string) || null)} items={tecnicoSelectItems}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>{tecnicosDisponibles.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
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
                <Input id="f-inicio" type="date" value={form.fechaInicio ?? ""} onChange={(e) => set("fechaInicio", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="f-cierre">Fecha de cierre</FieldLabel>
                <Input id="f-cierre" type="date" value={form.fechaCierre ?? ""} onChange={(e) => set("fechaCierre", e.target.value)} />
              </Field>

              <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Input
                    id="tiene-garantia"
                    type="checkbox"
                    className="size-4"
                    checked={garantia.tieneGarantia}
                    onChange={(e) => setGarantia((prev) => ({ ...prev, tieneGarantia: e.target.checked }))}
                  />
                  <div>
                    <FieldLabel htmlFor="tiene-garantia">Este servicio tiene garantía</FieldLabel>
                    <p className="text-xs text-muted-foreground">La vigencia queda registrada y cualquier atención posterior se abrirá como una nueva orden.</p>
                  </div>
                </div>

                {garantia.tieneGarantia ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel htmlFor="garantia-duracion">Duración</FieldLabel>
                      <Input
                        id="garantia-duracion"
                        type="number"
                        min={1}
                        step={1}
                        value={garantia.duracionValor ?? ""}
                        onChange={(e) => setGarantia((prev) => ({ ...prev, duracionValor: e.target.value === "" ? null : Number(e.target.value) }))}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Unidad</FieldLabel>
                      <Select value={garantia.duracionUnidad} onValueChange={(v) => setGarantia((prev) => ({ ...prev, duracionUnidad: v as GarantiaForm["duracionUnidad"] }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Días">Días</SelectItem>
                          <SelectItem value="Meses">Meses</SelectItem>
                          <SelectItem value="Años">Años</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Cobertura</FieldLabel>
                      <Select value={garantia.cobertura} onValueChange={(v) => setGarantia((prev) => ({ ...prev, cobertura: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mano de obra">Mano de obra</SelectItem>
                          <SelectItem value="Materiales">Materiales</SelectItem>
                          <SelectItem value="Mano de obra + materiales">Mano de obra + materiales</SelectItem>
                          <SelectItem value="Personalizada">Personalizada</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field className="sm:col-span-3">
                      <FieldLabel htmlFor="garantia-condiciones">Condiciones de garantía</FieldLabel>
                      <Textarea
                        id="garantia-condiciones"
                        value={garantia.condiciones}
                        onChange={(e) => setGarantia((prev) => ({ ...prev, condiciones: e.target.value }))}
                        placeholder="Condiciones, exclusiones o notas de cobertura."
                        rows={2}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="falla">Descripción de la falla</FieldLabel>
                <Textarea id="falla" value={form.descripcionFalla} onChange={(e) => set("descripcionFalla", e.target.value)} rows={2} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="diagnostico">Diagnóstico</FieldLabel>
                <Textarea id="diagnostico" value={form.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} rows={2} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="trabajo">Trabajo realizado</FieldLabel>
                <Textarea id="trabajo" value={form.trabajoRealizado} onChange={(e) => set("trabajoRealizado", e.target.value)} rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="materiales">Materiales</FieldLabel>
                <Textarea id="materiales" value={form.materiales} onChange={(e) => set("materiales", e.target.value)} rows={2} />
              </Field>
              <Field>
                <FieldLabel htmlFor="horas">Horas trabajadas</FieldLabel>
                <Input id="horas" type="number" min={0} step="0.5" value={form.horasTrabajadas ?? ""} onChange={(e) => set("horasTrabajadas", e.target.value === "" ? null : Number(e.target.value))} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="observaciones">Observaciones</FieldLabel>
                <Textarea id="observaciones" value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={2} />
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{orden ? "Guardar cambios" : "Crear orden"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

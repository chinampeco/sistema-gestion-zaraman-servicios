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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import {
  CARACTERES,
  ESTADOS_CONTRATO,
  PROCEDIMIENTOS,
  contratoToDb,
  mapContrato,
  type Caracter,
  type Contrato,
  type ContratoForm,
  type EstadoContrato,
  type Procedimiento,
} from "@/lib/contratos"

function vacio(): ContratoForm {
  return {
    clienteId: "",
    numeroContrato: "",
    objeto: "",
    areaRequirente: "",
    procedimiento: "Adjudicación directa",
    caracter: "Nacional",
    electronico: true,
    fechaFirma: null,
    vigenciaInicio: null,
    vigenciaFin: null,
    fechaLimiteEntrega: null,
    subtotal: 0,
    iva: 0,
    total: 0,
    moneda: "MXN",
    anticipoPct: 0,
    garantiaCumplimientoPct: 10,
    garantiaCalidadMeses: null,
    penaDiariaPct: null,
    penaMaximaPct: null,
    plazoPagoDiasHabiles: null,
    administradorNombre: "",
    administradorCargo: "",
    lugarEjecucion: "",
    contactoTelefono: "",
    contactoEmail: "",
    suficienciaPresupuestal: "",
    estado: "Por iniciar",
    notas: "",
  }
}

const redondear = (n: number) => Math.round(n * 100) / 100

export function ContratoFormDialog({
  open,
  onOpenChange,
  contrato,
  onGuardado,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contrato?: Contrato | null
  onGuardado: (contrato: Contrato) => void
}) {
  const { clientes } = useStore()
  const [form, setForm] = React.useState<ContratoForm>(vacio())
  const [guardando, setGuardando] = React.useState(false)
  // Si el usuario no ha tocado IVA/total, se calculan con el 16 %.
  const [ivaManual, setIvaManual] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    if (contrato) {
      const { id: _id, empresaId: _e, createdAt: _c, ...resto } = contrato
      setForm(resto)
      setIvaManual(true)
    } else {
      setForm(vacio())
      setIvaManual(false)
    }
  }, [open, contrato])

  const set = <K extends keyof ContratoForm>(k: K, v: ContratoForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const numero = (v: string) => (v === "" ? 0 : Number(v))
  const numeroONull = (v: string) => (v === "" ? null : Number(v))

  const cambiarSubtotal = (v: string) => {
    const subtotal = numero(v)
    setForm((prev) =>
      ivaManual
        ? { ...prev, subtotal }
        : { ...prev, subtotal, iva: redondear(subtotal * 0.16), total: redondear(subtotal * 1.16) },
    )
  }

  const clientesOrdenados = React.useMemo(
    () =>
      [...clientes].sort((a, b) =>
        a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === "Gobierno" ? -1 : 1,
      ),
    [clientes],
  )

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.clienteId) return toast.error("Selecciona la dependencia o cliente.")
    if (!form.numeroContrato.trim()) return toast.error("Captura el número de contrato.")
    if (form.vigenciaInicio && form.vigenciaFin && form.vigenciaFin < form.vigenciaInicio)
      return toast.error("La vigencia termina antes de empezar.")

    setGuardando(true)
    const supabase = createClient()
    const payload = contratoToDb(form)
    const consulta = contrato
      ? supabase.from("contratos").update(payload).eq("id", contrato.id).select("*").single()
      : supabase.from("contratos").insert(payload).select("*").single()
    const { data, error } = await consulta
    setGuardando(false)
    if (error || !data) {
      if (error?.code === "23505") toast.error("Ya existe un contrato con ese número en esta empresa.")
      else toast.error(error?.message ?? "No se pudo guardar el contrato.")
      return
    }
    toast.success(contrato ? "Contrato actualizado." : "Contrato registrado.")
    onGuardado(mapContrato(data))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 sm:max-w-3xl">
        <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{contrato ? `Editar ${contrato.numeroContrato}` : "Registrar contrato"}</DialogTitle>
            <DialogDescription>
              Datos del instrumento tal como vienen en el contrato firmado.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <Seccion titulo="Generales">
              <Field className="sm:col-span-2">
                <FieldLabel>Dependencia / cliente</FieldLabel>
                <Select
                  value={form.clienteId}
                  onValueChange={(v) => set("clienteId", (v as string) ?? "")}
                  disabled={!!contrato}
                  items={clientesOrdenados.map((c) => ({ value: c.id, label: c.nombre }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona la dependencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientesOrdenados.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                        {c.tipo === "Gobierno" ? " · Gobierno" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contrato ? (
                  <FieldDescription>El cliente de un contrato no se cambia.</FieldDescription>
                ) : (
                  <FieldDescription>
                    Si la dependencia no aparece, regístrala en Clientes con tipo “Gobierno”.
                  </FieldDescription>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="c-numero">Número de contrato</FieldLabel>
                <Input
                  id="c-numero"
                  value={form.numeroContrato}
                  onChange={(e) => set("numeroContrato", e.target.value)}
                  placeholder="D.G.ADMÓN. SAE-245/P/2026"
                />
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select value={form.estado} onValueChange={(v) => set("estado", v as EstadoContrato)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_CONTRATO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="c-objeto">Objeto del contrato</FieldLabel>
                <Textarea
                  id="c-objeto"
                  rows={2}
                  value={form.objeto}
                  onChange={(e) => set("objeto", e.target.value)}
                  placeholder="Servicio de mantenimiento a las albercas de las UU.DD. e II. del Ejército y F.A.M."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-area">Área requirente</FieldLabel>
                <Input id="c-area" value={form.areaRequirente} onChange={(e) => set("areaRequirente", e.target.value)} placeholder="Dirección General de Materiales de Guerra" />
              </Field>
              <Field>
                <FieldLabel>Procedimiento</FieldLabel>
                <Select value={form.procedimiento} onValueChange={(v) => set("procedimiento", v as Procedimiento)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROCEDIMIENTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Carácter</FieldLabel>
                <Select value={form.caracter} onValueChange={(v) => set("caracter", v as Caracter)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CARACTERES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal" className="items-center">
                <Switch id="c-electronico" checked={form.electronico} onCheckedChange={(v) => set("electronico", v)} />
                <FieldLabel htmlFor="c-electronico">Procedimiento electrónico</FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="c-suficiencia">Suficiencia presupuestal</FieldLabel>
                <Input id="c-suficiencia" value={form.suficienciaPresupuestal} onChange={(e) => set("suficienciaPresupuestal", e.target.value)} placeholder="SP/420/2026" />
              </Field>
            </Seccion>

            <Seccion titulo="Fechas">
              <CampoFecha id="c-firma" etiqueta="Fecha de firma" valor={form.fechaFirma} onChange={(v) => set("fechaFirma", v)} />
              <CampoFecha id="c-limite" etiqueta="Fecha límite de entrega" valor={form.fechaLimiteEntrega} onChange={(v) => set("fechaLimiteEntrega", v)} />
              <CampoFecha id="c-inicio" etiqueta="Vigencia desde" valor={form.vigenciaInicio} onChange={(v) => set("vigenciaInicio", v)} />
              <CampoFecha id="c-fin" etiqueta="Vigencia hasta" valor={form.vigenciaFin} onChange={(v) => set("vigenciaFin", v)} />
            </Seccion>

            <Seccion titulo="Montos">
              <Field>
                <FieldLabel htmlFor="c-subtotal">Subtotal (sin IVA)</FieldLabel>
                <Input id="c-subtotal" type="number" min={0} step="0.01" value={form.subtotal || ""} onChange={(e) => cambiarSubtotal(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-iva">IVA</FieldLabel>
                <Input id="c-iva" type="number" min={0} step="0.01" value={form.iva || ""} onChange={(e) => { setIvaManual(true); set("iva", numero(e.target.value)) }} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-total">Total</FieldLabel>
                <Input id="c-total" type="number" min={0} step="0.01" value={form.total || ""} onChange={(e) => { setIvaManual(true); set("total", numero(e.target.value)) }} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-anticipo">Anticipo (%)</FieldLabel>
                <Input id="c-anticipo" type="number" min={0} max={100} step="0.01" value={form.anticipoPct} onChange={(e) => set("anticipoPct", numero(e.target.value))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-pago">Plazo de pago (días hábiles)</FieldLabel>
                <Input id="c-pago" type="number" min={0} value={form.plazoPagoDiasHabiles ?? ""} onChange={(e) => set("plazoPagoDiasHabiles", numeroONull(e.target.value))} />
              </Field>
            </Seccion>

            <Seccion titulo="Garantías y penas">
              <Field>
                <FieldLabel htmlFor="c-gcump">Garantía de cumplimiento (%)</FieldLabel>
                <Input id="c-gcump" type="number" min={0} max={100} step="0.01" value={form.garantiaCumplimientoPct ?? ""} onChange={(e) => set("garantiaCumplimientoPct", numeroONull(e.target.value))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-gcal">Garantía de calidad (meses)</FieldLabel>
                <Input id="c-gcal" type="number" min={0} value={form.garantiaCalidadMeses ?? ""} onChange={(e) => set("garantiaCalidadMeses", numeroONull(e.target.value))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-pena">Pena convencional diaria (%)</FieldLabel>
                <Input id="c-pena" type="number" min={0} max={100} step="0.01" value={form.penaDiariaPct ?? ""} onChange={(e) => set("penaDiariaPct", numeroONull(e.target.value))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-penamax">Pena máxima (%)</FieldLabel>
                <Input id="c-penamax" type="number" min={0} max={100} step="0.01" value={form.penaMaximaPct ?? ""} onChange={(e) => set("penaMaximaPct", numeroONull(e.target.value))} />
              </Field>
            </Seccion>

            <Seccion titulo="Administración y contacto">
              <Field>
                <FieldLabel htmlFor="c-admin">Administrador del contrato</FieldLabel>
                <Input id="c-admin" value={form.administradorNombre} onChange={(e) => set("administradorNombre", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-admincargo">Cargo</FieldLabel>
                <Input id="c-admincargo" value={form.administradorCargo} onChange={(e) => set("administradorCargo", e.target.value)} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="c-lugar">Lugar de ejecución</FieldLabel>
                <Input id="c-lugar" value={form.lugarEjecucion} onChange={(e) => set("lugarEjecucion", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-tel">Teléfono del área</FieldLabel>
                <Input id="c-tel" value={form.contactoTelefono} onChange={(e) => set("contactoTelefono", e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="c-mail">Correo del área</FieldLabel>
                <Input id="c-mail" type="email" value={form.contactoEmail} onChange={(e) => set("contactoEmail", e.target.value)} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="c-notas">Notas</FieldLabel>
                <Textarea id="c-notas" rows={2} value={form.notas} onChange={(e) => set("notas", e.target.value)} />
              </Field>
            </Seccion>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Spinner data-icon="inline-start" />}
              {contrato ? "Guardar cambios" : "Registrar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{titulo}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function CampoFecha({
  id,
  etiqueta,
  valor,
  onChange,
}: {
  id: string
  etiqueta: string
  valor: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input id={id} type="date" value={valor ?? ""} onChange={(e) => onChange(e.target.value || null)} />
    </Field>
  )
}

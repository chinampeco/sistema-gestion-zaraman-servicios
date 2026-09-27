"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"

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
import { formatMoneda } from "@/lib/format"
import {
  ESTADOS_COTIZACION,
  TIPOS_CONCEPTO,
  type ConceptoCotizacion,
  type Cotizacion,
  type EstadoCotizacion,
  type TipoConcepto,
} from "@/lib/types"

interface CotizacionPrefill {
  clienteId?: string
  contacto?: string
  leadId?: string | null
  observaciones?: string
}

interface CotizacionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cotizacion?: Cotizacion | null
  // Valores iniciales al crear una cotización desde otro contexto (p.ej. un lead).
  prefill?: CotizacionPrefill | null
}

type FormState = Omit<Cotizacion, "id" | "folio" | "createdAt">

// IVA estándar en México.
const IVA_RATE = 0.16

function conceptoVacio(): ConceptoCotizacion {
  return {
    descripcion: "",
    tipo: "Material",
    cantidad: 1,
    precioUnitario: 0,
    descuento: 0,
  }
}

function emptyForm(creadoPor: string): FormState {
  return {
    clienteId: "",
    equipoId: null,
    contacto: "",
    conceptos: [conceptoVacio()],
    subtotal: 0,
    descuento: 0,
    iva: 0,
    total: 0,
    vigencia: null,
    condiciones: "",
    observaciones: "",
    estado: "Borrador",
    ordenId: null,
    leadId: null,
    creadoPor,
  }
}

/** Importe neto de una línea (cantidad x precio, menos descuento %). */
function importeLinea(c: ConceptoCotizacion): number {
  const bruto = c.cantidad * c.precioUnitario
  const desc = bruto * (c.descuento / 100)
  return Math.max(0, bruto - desc)
}

function calcularTotales(conceptos: ConceptoCotizacion[]) {
  const subtotalBruto = conceptos.reduce(
    (acc, c) => acc + c.cantidad * c.precioUnitario,
    0,
  )
  const subtotalNeto = conceptos.reduce((acc, c) => acc + importeLinea(c), 0)
  const descuento = subtotalBruto - subtotalNeto
  const iva = subtotalNeto * IVA_RATE
  const total = subtotalNeto + iva
  return { subtotal: subtotalBruto, descuento, iva, total }
}

export function CotizacionFormDialog({
  open,
  onOpenChange,
  cotizacion,
  prefill,
}: CotizacionFormDialogProps) {
  const {
    clientes,
    equipos,
    usuarioActual,
    crearCotizacion,
    actualizarCotizacion,
  } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm(usuarioActual.id))

  React.useEffect(() => {
    if (open) {
      setForm(
        cotizacion
          ? {
              clienteId: cotizacion.clienteId,
              equipoId: cotizacion.equipoId,
              contacto: cotizacion.contacto,
              conceptos:
                cotizacion.conceptos.length > 0
                  ? cotizacion.conceptos.map((c) => ({ ...c }))
                  : [conceptoVacio()],
              subtotal: cotizacion.subtotal,
              descuento: cotizacion.descuento,
              iva: cotizacion.iva,
              total: cotizacion.total,
              vigencia: cotizacion.vigencia,
              condiciones: cotizacion.condiciones,
              observaciones: cotizacion.observaciones,
              estado: cotizacion.estado,
              ordenId: cotizacion.ordenId,
              leadId: cotizacion.leadId ?? null,
              creadoPor: cotizacion.creadoPor,
            }
          : {
              ...emptyForm(usuarioActual.id),
              ...(prefill?.clienteId ? { clienteId: prefill.clienteId } : {}),
              ...(prefill?.contacto ? { contacto: prefill.contacto } : {}),
              ...(prefill?.leadId ? { leadId: prefill.leadId } : {}),
              ...(prefill?.observaciones
                ? { observaciones: prefill.observaciones }
                : {}),
            },
      )
    }
  }, [open, cotizacion, usuarioActual.id, prefill])

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

  const totales = calcularTotales(form.conceptos)

  const handleClienteChange = (value: string | null) => {
    const clienteId = value ?? ""
    setForm((prev) => ({ ...prev, clienteId, equipoId: null }))
  }

  const setConcepto = (
    index: number,
    key: keyof ConceptoCotizacion,
    value: string | number,
  ) => {
    setForm((prev) => ({
      ...prev,
      conceptos: prev.conceptos.map((c, i) =>
        i === index ? { ...c, [key]: value } : c,
      ),
    }))
  }

  const agregarConcepto = () =>
    setForm((prev) => ({ ...prev, conceptos: [...prev.conceptos, conceptoVacio()] }))

  const eliminarConcepto = (index: number) =>
    setForm((prev) => ({
      ...prev,
      conceptos:
        prev.conceptos.length > 1
          ? prev.conceptos.filter((_, i) => i !== index)
          : prev.conceptos,
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) {
      toast.error("Selecciona un cliente.")
      return
    }
    const conceptosValidos = form.conceptos.filter((c) => c.descripcion.trim())
    if (conceptosValidos.length === 0) {
      toast.error("Agrega al menos un concepto con descripción.")
      return
    }
    const t = calcularTotales(conceptosValidos)
    const payload: FormState = {
      ...form,
      equipoId: form.equipoId || null,
      conceptos: conceptosValidos,
      subtotal: t.subtotal,
      descuento: t.descuento,
      iva: t.iva,
      total: t.total,
      vigencia: form.vigencia || null,
    }
    if (cotizacion) {
      const actualizada = await actualizarCotizacion(cotizacion.id, payload)
      if (!actualizada) return
      onOpenChange(false)
      return
    }

    const nuevaCotizacion = await crearCotizacion(payload)
    if (!nuevaCotizacion) return

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {cotizacion
                ? `Editar cotización ${cotizacion.folio}`
                : "Nueva cotización"}
            </DialogTitle>
            <DialogDescription>
              {cotizacion
                ? "Actualiza los datos de la cotización."
                : "El folio se genera automáticamente al guardar."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Cliente</FieldLabel>
                <Select
                  value={form.clienteId}
                  onValueChange={handleClienteChange}
                  items={clienteSelectItems}
                >
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
                  items={equipoSelectItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        form.clienteId
                          ? "Sin equipo específico"
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
                <FieldLabel htmlFor="contacto">Contacto</FieldLabel>
                <Input
                  id="contacto"
                  value={form.contacto}
                  onChange={(e) => set("contacto", e.target.value)}
                  placeholder="Persona de contacto"
                />
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select
                  value={form.estado}
                  onValueChange={(v) =>
                    set("estado", (v as EstadoCotizacion) ?? "Borrador")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_COTIZACION.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="vigencia">Vigencia</FieldLabel>
                <Input
                  id="vigencia"
                  type="date"
                  value={form.vigencia ?? ""}
                  onChange={(e) => set("vigencia", e.target.value)}
                />
              </Field>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <FieldLabel className="text-sm font-semibold">Conceptos</FieldLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={agregarConcepto}
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {form.conceptos.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <Field className="sm:col-span-5">
                      <FieldLabel htmlFor={`desc-${i}`}>Descripción</FieldLabel>
                      <Input
                        id={`desc-${i}`}
                        value={c.descripcion}
                        onChange={(e) =>
                          setConcepto(i, "descripcion", e.target.value)
                        }
                        placeholder="Concepto o servicio"
                      />
                    </Field>
                    <Field className="sm:col-span-3">
                      <FieldLabel>Tipo</FieldLabel>
                      <Select
                        value={c.tipo}
                        onValueChange={(v) =>
                          setConcepto(i, "tipo", (v as TipoConcepto) ?? "Material")
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS_CONCEPTO.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor={`cant-${i}`}>Cant.</FieldLabel>
                      <Input
                        id={`cant-${i}`}
                        type="number"
                        min={0}
                        step="1"
                        value={c.cantidad}
                        onChange={(e) =>
                          setConcepto(i, "cantidad", Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor={`precio-${i}`}>Precio</FieldLabel>
                      <Input
                        id={`precio-${i}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={c.precioUnitario}
                        onChange={(e) =>
                          setConcepto(
                            i,
                            "precioUnitario",
                            Number(e.target.value) || 0,
                          )
                        }
                      />
                    </Field>
                    <Field className="sm:col-span-3">
                      <FieldLabel htmlFor={`descto-${i}`}>Desc. %</FieldLabel>
                      <Input
                        id={`descto-${i}`}
                        type="number"
                        min={0}
                        max={100}
                        step="1"
                        value={c.descuento}
                        onChange={(e) =>
                          setConcepto(i, "descuento", Number(e.target.value) || 0)
                        }
                      />
                    </Field>
                    <div className="flex items-end justify-between gap-2 sm:col-span-9">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Importe: </span>
                        <span className="font-medium tabular-nums">
                          {formatMoneda(importeLinea(c))}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => eliminarConcepto(i)}
                        disabled={form.conceptos.length === 1}
                      >
                        <Trash2 className="size-4" />
                        <span className="sr-only">Eliminar concepto</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ml-auto mt-2 w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoneda(totales.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Descuento</span>
                <span className="tabular-nums">
                  -{formatMoneda(totales.descuento)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IVA (16%)</span>
                <span className="tabular-nums">{formatMoneda(totales.iva)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoneda(totales.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="condiciones">Condiciones</FieldLabel>
                <Textarea
                  id="condiciones"
                  value={form.condiciones}
                  onChange={(e) => set("condiciones", e.target.value)}
                  rows={2}
                  placeholder="Condiciones comerciales, forma de pago, etc."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="observaciones">Observaciones</FieldLabel>
                <Textarea
                  id="observaciones"
                  value={form.observaciones}
                  onChange={(e) => set("observaciones", e.target.value)}
                  rows={2}
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
              {cotizacion ? "Guardar cambios" : "Crear cotización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

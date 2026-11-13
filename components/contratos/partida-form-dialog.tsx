"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { CamposUbicacion } from "@/components/ubicacion/campos-ubicacion"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import {
  formatoMoneda,
  mapPartida,
  partidaToDb,
  type ContratoPartida,
  type EquipoPartida,
  type PartidaForm,
} from "@/lib/contratos"

const equipoVacio = (): EquipoPartida => ({
  descripcion: "",
  cantidad: 1,
  marca: "",
  modelo: "",
  serie: "",
  inventario: "",
})

function vacio(numero: number): PartidaForm {
  return {
    numero,
    descripcion: "",
    unidad: "Servicio",
    cantidad: 1,
    precioUnitario: 0,
    cucop: "",
    alcance: "",
    lugarEjecucion: "",
    equipos: [],
    region: "",
    zona: "",
    instalacion: "",
    area: "",
  }
}

export function PartidaFormDialog({
  open,
  onOpenChange,
  contratoId,
  partida,
  siguienteNumero,
  esGobierno,
  onGuardada,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratoId: string
  partida?: ContratoPartida | null
  siguienteNumero: number
  esGobierno: boolean
  onGuardada: (p: ContratoPartida) => void
}) {
  const { equipos, ordenes } = useStore()
  const [form, setForm] = React.useState<PartidaForm>(vacio(siguienteNumero))
  const [guardando, setGuardando] = React.useState(false)
  const sugerencias = React.useMemo(() => [...equipos, ...ordenes], [equipos, ordenes])

  React.useEffect(() => {
    if (!open) return
    if (partida) {
      const { id: _i, contratoId: _c, importe: _imp, ...resto } = partida
      setForm({ ...resto, equipos: resto.equipos.map((e) => ({ ...e })) })
    } else {
      setForm(vacio(siguienteNumero))
    }
  }, [open, partida, siguienteNumero])

  const set = <K extends keyof PartidaForm>(k: K, v: PartidaForm[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const setEquipo = (i: number, cambios: Partial<EquipoPartida>) =>
    setForm((prev) => ({
      ...prev,
      equipos: prev.equipos.map((e, j) => (j === i ? { ...e, ...cambios } : e)),
    }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) return toast.error("Describe la partida.")
    if (!(form.numero > 0)) return toast.error("El número de partida debe ser mayor a cero.")
    if (!(form.cantidad > 0)) return toast.error("La cantidad debe ser mayor a cero.")

    setGuardando(true)
    const supabase = createClient()
    const payload = partidaToDb(form)
    const consulta = partida
      ? supabase.from("contrato_partidas").update(payload).eq("id", partida.id).select("*").single()
      : supabase
          .from("contrato_partidas")
          .insert({ ...payload, contrato_id: contratoId })
          .select("*")
          .single()
    const { data, error } = await consulta
    setGuardando(false)
    if (error || !data) {
      if (error?.code === "23505") toast.error(`Ya existe la partida ${form.numero} en este contrato.`)
      else toast.error(error?.message ?? "No se pudo guardar la partida.")
      return
    }
    toast.success(partida ? "Partida actualizada." : "Partida agregada.")
    onGuardada(mapPartida(data))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 sm:max-w-4xl">
        <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{partida ? `Editar partida ${partida.numero}` : "Agregar partida"}</DialogTitle>
            <DialogDescription>
              Lo contratado en esta partida, su alcance (anexo técnico / ficha) y los equipos que cubre.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
              <Field className="col-span-1">
                <FieldLabel htmlFor="p-num">Partida</FieldLabel>
                <Input id="p-num" type="number" min={1} value={form.numero || ""} onChange={(e) => set("numero", Number(e.target.value))} />
              </Field>
              <Field className="col-span-1 sm:col-span-2">
                <FieldLabel htmlFor="p-unidad">Unidad de medida</FieldLabel>
                <Input id="p-unidad" value={form.unidad} onChange={(e) => set("unidad", e.target.value)} />
              </Field>
              <Field className="col-span-1">
                <FieldLabel htmlFor="p-cant">Cantidad</FieldLabel>
                <Input id="p-cant" type="number" min={0} step="0.01" value={form.cantidad || ""} onChange={(e) => set("cantidad", Number(e.target.value))} />
              </Field>
              <Field className="col-span-1 sm:col-span-2">
                <FieldLabel htmlFor="p-precio">Precio unitario (sin IVA)</FieldLabel>
                <Input id="p-precio" type="number" min={0} step="0.01" value={form.precioUnitario || ""} onChange={(e) => set("precioUnitario", Number(e.target.value))} />
                <FieldDescription>Importe: {formatoMoneda(form.cantidad * form.precioUnitario)}</FieldDescription>
              </Field>
              <Field className="col-span-2 sm:col-span-4">
                <FieldLabel htmlFor="p-desc">Descripción</FieldLabel>
                <Input id="p-desc" value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Mantenimiento a 1 (una) alberca del Centro Militar de Ciencias de la Salud" />
              </Field>
              <Field className="col-span-2">
                <FieldLabel htmlFor="p-cucop">CUCoP</FieldLabel>
                <Input id="p-cucop" value={form.cucop} onChange={(e) => set("cucop", e.target.value)} placeholder="35701-0001" />
              </Field>
              <Field className="col-span-2 sm:col-span-6">
                <FieldLabel htmlFor="p-alcance">Alcance (texto de la ficha técnica)</FieldLabel>
                <Textarea id="p-alcance" rows={4} value={form.alcance} onChange={(e) => set("alcance", e.target.value)} />
              </Field>
              <Field className="col-span-2 sm:col-span-6">
                <FieldLabel htmlFor="p-lugar">Lugar de ejecución (domicilio)</FieldLabel>
                <Input id="p-lugar" value={form.lugarEjecucion} onChange={(e) => set("lugarEjecucion", e.target.value)} placeholder="Calle Gral. García Conde Palomas S/N, Col. Lomas de Sotelo, Miguel Hidalgo, Cd. Méx." />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              <CamposUbicacion
                value={form}
                onChange={(u) => setForm((prev) => ({ ...prev, ...u }))}
                sugerencias={sugerencias}
                requerido={esGobierno}
                descripcion="Las órdenes de esta partida nacen con esta ubicación."
              />
            </div>

            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Equipos de la partida</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => set("equipos", [...form.equipos, equipoVacio()])}>
                  <Plus data-icon="inline-start" />
                  Agregar equipo
                </Button>
              </div>
              {form.equipos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin equipos. Agrega los que lista la ficha técnica (descripción, marca, serie o número de inventario).
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {form.equipos.map((eq, i) => (
                    <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-2 sm:grid-cols-12">
                      <Field className="col-span-2 sm:col-span-3">
                        <FieldLabel className="text-xs">Descripción</FieldLabel>
                        <Input value={eq.descripcion} onChange={(e) => setEquipo(i, { descripcion: e.target.value })} placeholder="Bomba de calor" />
                      </Field>
                      <Field className="sm:col-span-1">
                        <FieldLabel className="text-xs">Cant.</FieldLabel>
                        <Input type="number" min={1} value={eq.cantidad} onChange={(e) => setEquipo(i, { cantidad: Number(e.target.value) })} />
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel className="text-xs">Marca</FieldLabel>
                        <Input value={eq.marca} onChange={(e) => setEquipo(i, { marca: e.target.value })} />
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel className="text-xs">Modelo</FieldLabel>
                        <Input value={eq.modelo} onChange={(e) => setEquipo(i, { modelo: e.target.value })} />
                      </Field>
                      <Field className="sm:col-span-2">
                        <FieldLabel className="text-xs">No. de serie</FieldLabel>
                        <Input value={eq.serie} onChange={(e) => setEquipo(i, { serie: e.target.value })} />
                      </Field>
                      <Field className="col-span-2 sm:col-span-2">
                        <FieldLabel className="text-xs">No. inventario (S.I.L.)</FieldLabel>
                        <div className="flex gap-1">
                          <Input value={eq.inventario} onChange={(e) => setEquipo(i, { inventario: e.target.value })} className="font-mono text-xs" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Quitar equipo"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => set("equipos", form.equipos.filter((_, j) => j !== i))}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </Field>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>
              {guardando && <Spinner data-icon="inline-start" />}
              {partida ? "Guardar cambios" : "Agregar partida"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

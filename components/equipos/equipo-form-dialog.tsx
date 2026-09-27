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
import { ESTADOS_EQUIPO, type Equipo, type EstadoEquipo } from "@/lib/types"

interface EquipoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipo?: Equipo | null
  clienteIdPredeterminado?: string
}

type FormState = Omit<Equipo, "id">

function emptyForm(clienteId = ""): FormState {
  return {
    clienteId,
    tipo: "",
    marca: "",
    modelo: "",
    numeroSerie: "",
    capacidad: "",
    ubicacion: "",
    estado: "Operativo",
    fechaInstalacion: "",
    fechaUltimoServicio: null,
    fechaProximoServicio: null,
    notas: "",
  }
}

export function EquipoFormDialog({
  open,
  onOpenChange,
  equipo,
  clienteIdPredeterminado,
}: EquipoFormDialogProps) {
  const { clientes, crearEquipo, actualizarEquipo } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm())

  React.useEffect(() => {
    if (open) {
      setForm(equipo ? { ...equipo } : emptyForm(clienteIdPredeterminado))
    }
  }, [open, equipo, clienteIdPredeterminado])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clienteId) {
      toast.error("Selecciona un cliente.")
      return
    }
    if (!form.tipo.trim()) {
      toast.error("El tipo de equipo es obligatorio.")
      return
    }
    const payload: FormState = {
      ...form,
      fechaUltimoServicio: form.fechaUltimoServicio || null,
      fechaProximoServicio: form.fechaProximoServicio || null,
    }
    if (equipo) {
      actualizarEquipo(equipo.id, payload)
      toast.success("Equipo actualizado correctamente.")
    } else {
      crearEquipo(payload)
      toast.success("Equipo registrado correctamente.")
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {equipo ? "Editar equipo" : "Registrar equipo"}
            </DialogTitle>
            <DialogDescription>
              {equipo
                ? "Actualiza la información del equipo."
                : "Registra un nuevo equipo y asócialo a un cliente."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel>Cliente</FieldLabel>
                <Select
                  value={form.clienteId}
                  onValueChange={(v) => set("clienteId", (v as string) ?? "")}
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
                <FieldLabel htmlFor="tipo">Tipo de equipo</FieldLabel>
                <Input
                  id="tipo"
                  value={form.tipo}
                  onChange={(e) => set("tipo", e.target.value)}
                  placeholder="Compresor, Chiller, Motor…"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="marca">Marca</FieldLabel>
                <Input
                  id="marca"
                  value={form.marca}
                  onChange={(e) => set("marca", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="modelo">Modelo</FieldLabel>
                <Input
                  id="modelo"
                  value={form.modelo}
                  onChange={(e) => set("modelo", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="serie">Número de serie</FieldLabel>
                <Input
                  id="serie"
                  value={form.numeroSerie}
                  onChange={(e) => set("numeroSerie", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="capacidad">Capacidad</FieldLabel>
                <Input
                  id="capacidad"
                  value={form.capacidad}
                  onChange={(e) => set("capacidad", e.target.value)}
                  placeholder="50 HP, 100 TR…"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ubicacion">Ubicación</FieldLabel>
                <Input
                  id="ubicacion"
                  value={form.ubicacion}
                  onChange={(e) => set("ubicacion", e.target.value)}
                  placeholder="Planta 1, Área de producción…"
                />
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select
                  value={form.estado}
                  onValueChange={(v) =>
                    set("estado", (v as EstadoEquipo) ?? "Operativo")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_EQUIPO.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="instalacion">Fecha de instalación</FieldLabel>
                <Input
                  id="instalacion"
                  type="date"
                  value={form.fechaInstalacion}
                  onChange={(e) => set("fechaInstalacion", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ultimo">Último servicio</FieldLabel>
                <Input
                  id="ultimo"
                  type="date"
                  value={form.fechaUltimoServicio ?? ""}
                  onChange={(e) => set("fechaUltimoServicio", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="proximo">Próximo servicio</FieldLabel>
                <Input
                  id="proximo"
                  type="date"
                  value={form.fechaProximoServicio ?? ""}
                  onChange={(e) => set("fechaProximoServicio", e.target.value)}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notas-eq">Notas</FieldLabel>
                <Textarea
                  id="notas-eq"
                  value={form.notas}
                  onChange={(e) => set("notas", e.target.value)}
                  rows={3}
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
              {equipo ? "Guardar cambios" : "Registrar equipo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

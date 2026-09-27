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
import { PLATAFORMAS_CAMPANA, type MarketingCampana } from "@/lib/types"

interface CampanaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campana?: MarketingCampana | null
}

type FormState = Omit<MarketingCampana, "id" | "createdAt">

function emptyForm(): FormState {
  return {
    nombre: "",
    plataforma: "Facebook Ads",
    objetivo: "",
    servicio: "",
    fechaInicio: "",
    fechaFin: "",
    presupuesto: 0,
    gastoReal: 0,
    activa: true,
  }
}

export function CampanaFormDialog({
  open,
  onOpenChange,
  campana,
}: CampanaFormDialogProps) {
  const { crearCampana, actualizarCampana } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm())

  React.useEffect(() => {
    if (open) {
      setForm(
        campana
          ? {
              nombre: campana.nombre,
              plataforma: campana.plataforma || "Facebook Ads",
              objetivo: campana.objetivo,
              servicio: campana.servicio,
              fechaInicio: campana.fechaInicio ?? "",
              fechaFin: campana.fechaFin ?? "",
              presupuesto: campana.presupuesto,
              gastoReal: campana.gastoReal,
              activa: campana.activa,
            }
          : emptyForm(),
      )
    }
  }, [open, campana])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error("El nombre de la campaña es obligatorio.")
      return
    }
    const payload: FormState = {
      ...form,
      fechaInicio: form.fechaInicio || null,
      fechaFin: form.fechaFin || null,
      presupuesto: Number(form.presupuesto) || 0,
      gastoReal: Number(form.gastoReal) || 0,
    }
    if (campana) {
      await actualizarCampana(campana.id, payload)
    } else {
      await crearCampana(payload)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{campana ? "Editar campaña" : "Nueva campaña"}</DialogTitle>
            <DialogDescription>
              {campana
                ? "Actualiza la información de la campaña de marketing."
                : "Registra una campaña para dar seguimiento a su inversión y resultados."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="nombre-camp">Nombre de la campaña</FieldLabel>
                <Input
                  id="nombre-camp"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Mantenimiento industrial - Verano"
                />
              </Field>
              <Field>
                <FieldLabel>Plataforma</FieldLabel>
                <Select
                  value={form.plataforma}
                  onValueChange={(v) => set("plataforma", (v as string) ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATAFORMAS_CAMPANA.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="servicio-camp">Servicio promocionado</FieldLabel>
                <Input
                  id="servicio-camp"
                  value={form.servicio}
                  onChange={(e) => set("servicio", e.target.value)}
                  placeholder="Compresores, Chillers…"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="objetivo-camp">Objetivo</FieldLabel>
                <Textarea
                  id="objetivo-camp"
                  value={form.objetivo}
                  onChange={(e) => set("objetivo", e.target.value)}
                  rows={2}
                  placeholder="Generar leads de mantenimiento preventivo en la zona norte."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inicio-camp">Fecha de inicio</FieldLabel>
                <Input
                  id="inicio-camp"
                  type="date"
                  value={form.fechaInicio ?? ""}
                  onChange={(e) => set("fechaInicio", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fin-camp">Fecha de fin</FieldLabel>
                <Input
                  id="fin-camp"
                  type="date"
                  value={form.fechaFin ?? ""}
                  onChange={(e) => set("fechaFin", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="presupuesto-camp">Presupuesto (MXN)</FieldLabel>
                <Input
                  id="presupuesto-camp"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.presupuesto}
                  onChange={(e) => set("presupuesto", Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="gasto-camp">Gasto real (MXN)</FieldLabel>
                <Input
                  id="gasto-camp"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.gastoReal}
                  onChange={(e) => set("gastoReal", Number(e.target.value))}
                />
              </Field>
              <Field>
                <FieldLabel>Estado</FieldLabel>
                <Select
                  value={form.activa ? "activa" : "pausada"}
                  onValueChange={(v) => set("activa", v === "activa")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="pausada">Pausada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{campana ? "Guardar cambios" : "Crear campaña"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

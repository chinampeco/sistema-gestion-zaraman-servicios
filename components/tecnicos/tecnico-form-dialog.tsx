"use client"

import * as React from "react"
import { useStore } from "@/lib/store"
import { ROLES_TECNICO, type Tecnico } from "@/lib/types"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface TecnicoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tecnico?: Tecnico | null
}

type FormState = Omit<Tecnico, "id">

const emptyForm: FormState = {
  nombre: "",
  rol: "Técnico",
  especialidad: "",
  zona: "",
  email: "",
  telefono: "",
  activo: true,
}

export function TecnicoFormDialog({
  open,
  onOpenChange,
  tecnico,
}: TecnicoFormDialogProps) {
  const { crearTecnico, actualizarTecnico } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm)

  React.useEffect(() => {
    if (open) {
      setForm(
        tecnico
          ? {
              nombre: tecnico.nombre,
              rol: tecnico.rol,
              especialidad: tecnico.especialidad,
              zona: tecnico.zona,
              email: tecnico.email,
              telefono: tecnico.telefono,
              activo: tecnico.activo,
            }
          : emptyForm,
      )
    }
  }, [open, tecnico])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (tecnico) {
      actualizarTecnico(tecnico.id, form)
    } else {
      crearTecnico(form)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {tecnico ? "Editar técnico" : "Nuevo técnico"}
            </DialogTitle>
            <DialogDescription>
              {tecnico
                ? "Actualiza la información del técnico."
                : "Registra un nuevo técnico en el equipo de servicio."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <Field>
              <FieldLabel htmlFor="nombre">Nombre completo</FieldLabel>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rol">Rol</FieldLabel>
                <Select
                  value={form.rol}
                  onValueChange={(v) => set("rol", v as Tecnico["rol"])}
                >
                  <SelectTrigger id="rol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_TECNICO.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="especialidad">Especialidad</FieldLabel>
                <Input
                  id="especialidad"
                  value={form.especialidad}
                  onChange={(e) => set("especialidad", e.target.value)}
                  placeholder="Refrigeración industrial"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="zona">Zona de cobertura</FieldLabel>
              <Input
                id="zona"
                value={form.zona}
                onChange={(e) => set("zona", e.target.value)}
                placeholder="Zona Norte, CDMX, etc."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="email">Correo</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </Field>
            </div>

            <Field orientation="horizontal">
              <Switch
                id="activo"
                checked={form.activo}
                onCheckedChange={(v) => set("activo", v)}
              />
              <FieldLabel htmlFor="activo">Técnico activo</FieldLabel>
            </Field>
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
              {tecnico ? "Guardar cambios" : "Crear técnico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

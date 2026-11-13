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
import { TIPOS_CLIENTE, type Cliente, type TipoCliente } from "@/lib/types"

interface ClienteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: Cliente | null
}

type FormState = Omit<Cliente, "id" | "createdAt">

const emptyForm: FormState = {
  tipo: "Particular",
  nombre: "",
  rfc: "",
  contacto: "",
  email: "",
  telefono: "",
  direccion: "",
  ciudad: "",
  notas: "",
}

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
}: ClienteFormDialogProps) {
  const { crearCliente, actualizarCliente } = useStore()
  const [form, setForm] = React.useState<FormState>(emptyForm)

  React.useEffect(() => {
    if (open) {
      setForm(
        cliente
          ? {
              tipo: cliente.tipo,
              nombre: cliente.nombre,
              rfc: cliente.rfc,
              contacto: cliente.contacto,
              email: cliente.email,
              telefono: cliente.telefono,
              direccion: cliente.direccion,
              ciudad: cliente.ciudad,
              notas: cliente.notas,
            }
          : emptyForm
      )
    }
  }, [open, cliente])

  const set = (key: Exclude<keyof FormState, "tipo">) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) {
      toast.error("El nombre del cliente es obligatorio.")
      return
    }
    if (cliente) {
      actualizarCliente(cliente.id, form)
      toast.success("Cliente actualizado correctamente.")
    } else {
      crearCliente(form)
      toast.success("Cliente creado correctamente.")
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {cliente ? "Editar cliente" : "Nuevo cliente"}
            </DialogTitle>
            <DialogDescription>
              {cliente
                ? "Actualiza la información del cliente."
                : "Registra un nuevo cliente en el sistema."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="nombre">Nombre / Razón social</FieldLabel>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => set("nombre")(e.target.value)}
                  placeholder="Industrias del Norte S.A. de C.V."
                />
              </Field>
              <Field>
                <FieldLabel>Tipo de cliente</FieldLabel>
                <Select
                  value={form.tipo}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, tipo: (v as TipoCliente) ?? "Particular" }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CLIENTE.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "Gobierno" ? "Gobierno (dependencia)" : "Particular"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="rfc">RFC</FieldLabel>
                <Input
                  id="rfc"
                  value={form.rfc}
                  onChange={(e) => set("rfc")(e.target.value)}
                  placeholder="XAXX010101000"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contacto">Persona de contacto</FieldLabel>
                <Input
                  id="contacto"
                  value={form.contacto}
                  onChange={(e) => set("contacto")(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => set("telefono")(e.target.value)}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="direccion">Dirección</FieldLabel>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={(e) => set("direccion")(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ciudad">Ciudad / Estado</FieldLabel>
                <Input
                  id="ciudad"
                  value={form.ciudad}
                  onChange={(e) => set("ciudad")(e.target.value)}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="notas">Notas</FieldLabel>
                <Textarea
                  id="notas"
                  value={form.notas}
                  onChange={(e) => set("notas")(e.target.value)}
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
              {cliente ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

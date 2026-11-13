"use client"

import * as React from "react"
import { MapPin } from "lucide-react"

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { CAMPOS_UBICACION, type Ubicacion } from "@/lib/types"
import { opcionesUbicacion } from "@/lib/ubicacion"

// Región / zona / instalación / área. Cada campo sugiere los valores ya
// capturados (de equipos y órdenes) para que se escriban igual y los filtros
// funcionen.
export function CamposUbicacion({
  value,
  onChange,
  sugerencias,
  requerido = false,
  descripcion,
}: {
  value: Ubicacion
  onChange: (value: Ubicacion) => void
  sugerencias: Ubicacion[]
  requerido?: boolean
  descripcion?: string
}) {
  const id = React.useId()
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3 sm:col-span-2">
      <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
        <MapPin className="size-4 text-muted-foreground" />
        Ubicación {requerido ? "(dependencia de gobierno)" : "(opcional)"}
      </legend>
      {descripcion && <FieldDescription>{descripcion}</FieldDescription>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAMPOS_UBICACION.map(({ clave, etiqueta, ejemplo }) => {
          const listaId = `${id}-${clave}`
          const opciones = opcionesUbicacion(sugerencias, clave, value)
          return (
            <Field key={clave}>
              <FieldLabel htmlFor={`${id}-${clave}-input`}>
                {etiqueta}
                {requerido && clave !== "area" ? " *" : ""}
              </FieldLabel>
              <Input
                id={`${id}-${clave}-input`}
                list={listaId}
                value={value[clave]}
                onChange={(e) => onChange({ ...value, [clave]: e.target.value })}
                placeholder={ejemplo}
                autoComplete="off"
              />
              <datalist id={listaId}>
                {opciones.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </Field>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Mensaje de error si falta un nivel obligatorio (región, zona, instalación). */
export function validarUbicacionRequerida(u: Ubicacion): string | null {
  const faltantes = CAMPOS_UBICACION.filter(
    ({ clave }) => clave !== "area" && !u[clave].trim(),
  ).map(({ etiqueta }) => etiqueta.toLowerCase())
  if (faltantes.length === 0) return null
  return `Para clientes de gobierno indica: ${faltantes.join(", ")}.`
}

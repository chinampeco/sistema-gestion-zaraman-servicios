"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CAMPOS_UBICACION, type Ubicacion } from "@/lib/types"
import { opcionesUbicacion, tieneUbicacion, UBICACION_VACIA, type FiltroUbicacion } from "@/lib/ubicacion"

const TODAS = "__todas__"

// Filtros en cascada por región → zona → instalación → área. Solo aparecen si
// hay registros con ubicación capturada.
export function FiltrosUbicacion({
  items,
  value,
  onChange,
}: {
  items: Ubicacion[]
  value: FiltroUbicacion
  onChange: (value: FiltroUbicacion) => void
}) {
  if (!items.some(tieneUbicacion) && !tieneUbicacion(value)) return null

  const cambiar = (clave: keyof Ubicacion, nuevo: string) => {
    // Al cambiar un nivel se limpian los niveles siguientes.
    const indice = CAMPOS_UBICACION.findIndex((c) => c.clave === clave)
    const siguiente: FiltroUbicacion = { ...value, [clave]: nuevo === TODAS ? "" : nuevo }
    for (const c of CAMPOS_UBICACION.slice(indice + 1)) siguiente[c.clave] = ""
    onChange(siguiente)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {CAMPOS_UBICACION.map(({ clave, etiqueta }) => {
        const opciones = opcionesUbicacion(items, clave, value)
        return (
          <Select
            key={clave}
            value={value[clave] || TODAS}
            onValueChange={(v) => cambiar(clave, (v as string) ?? TODAS)}
            itemToStringLabel={(v) =>
              v === TODAS ? `${etiqueta}: todas` : `${etiqueta}: ${String(v)}`
            }
          >
            <SelectTrigger className="w-full sm:w-52" aria-label={`Filtrar por ${etiqueta.toLowerCase()}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{etiqueta}: todas</SelectItem>
              {opciones.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}
      {tieneUbicacion(value) && (
        <Button variant="ghost" size="sm" onClick={() => onChange(UBICACION_VACIA)}>
          <X data-icon="inline-start" />
          Quitar filtros de ubicación
        </Button>
      )}
    </div>
  )
}

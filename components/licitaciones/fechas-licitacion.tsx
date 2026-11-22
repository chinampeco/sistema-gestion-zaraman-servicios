"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatFechaHora } from "@/lib/format"
import { TIPOS_EVENTO, diasPara, eventoPorAtender, textoDias, type EventoLicitacion, type TipoEvento } from "@/lib/licitaciones"
import { createClient } from "@/lib/supabase/client"
import type { DatosLicitacion } from "./use-licitacion"

export function FechasLicitacion({
  datos,
  puedeGestionar,
  puedeEliminar,
  onCambio,
}: {
  datos: DatosLicitacion
  puedeGestionar: boolean
  puedeEliminar: boolean
  onCambio: () => Promise<void>
}) {
  const [nuevo, setNuevo] = React.useState(false)

  async function marcar(e: EventoLicitacion, completado: boolean) {
    const { error } = await createClient().from("licitacion_eventos").update({ completado }).eq("id", e.id)
    if (error) return toast.error("No se pudo guardar.")
    await onCambio()
  }

  async function eliminar(e: EventoLicitacion) {
    if (!window.confirm("¿Eliminar esta fecha?")) return
    const { error } = await createClient().from("licitacion_eventos").delete().eq("id", e.id)
    if (error) return toast.error("No se pudo eliminar.")
    await onCambio()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Las fechas pendientes aparecen en Notificaciones y al inicio de Licitaciones desde los días de aviso que elijas.
          Horario del centro de México.
        </p>
        {puedeGestionar && (
          <Button variant="outline" size="sm" onClick={() => setNuevo(true)}>
            <Plus data-icon="inline-start" />
            Agregar fecha
          </Button>
        )}
      </div>
      {datos.eventos.length === 0 && <p className="text-sm text-muted-foreground">Sin fechas. Léelas de la convocatoria con IA o agrégalas.</p>}
      {datos.eventos.map((e) => {
        const dias = diasPara(e.fecha)
        const urgente = eventoPorAtender(e)
        return (
          <div
            key={e.id}
            className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${e.completado ? "opacity-60" : urgente ? "border-amber-500/50" : ""}`}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{e.titulo || e.tipo}</span>
              <span className="text-sm text-muted-foreground">
                {formatFechaHora(e.fecha)}
                {!e.completado && (
                  <span className={dias < 0 ? " text-destructive" : dias <= 1 ? " text-amber-600" : ""}> · {textoDias(dias)}</span>
                )}
              </span>
              {e.notas && <span className="text-xs text-muted-foreground">{e.notas}</span>}
            </div>
            <Badge variant="outline">{e.tipo}</Badge>
            <span className="text-xs text-muted-foreground">Aviso {e.recordarDias} día(s) antes</span>
            {puedeGestionar && (
              <div className="flex items-center gap-2">
                <Switch id={`ev-${e.id}`} checked={e.completado} onCheckedChange={(v) => void marcar(e, v)} />
                <label htmlFor={`ev-${e.id}`} className="text-sm">
                  Hecho
                </label>
              </div>
            )}
            {puedeEliminar && (
              <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => eliminar(e)}>
                <Trash2 />
              </Button>
            )}
          </div>
        )
      })}
      {nuevo && (
        <NuevaFechaDialog
          licitacionId={datos.licitacion.id}
          onClose={() => setNuevo(false)}
          onCreada={async () => {
            setNuevo(false)
            await onCambio()
          }}
        />
      )}
    </div>
  )
}

function NuevaFechaDialog({
  licitacionId,
  onClose,
  onCreada,
}: {
  licitacionId: string
  onClose: () => void
  onCreada: () => Promise<void>
}) {
  const [tipo, setTipo] = React.useState<TipoEvento>("Visita de campo")
  const [titulo, setTitulo] = React.useState("")
  const [fecha, setFecha] = React.useState("")
  const [hora, setHora] = React.useState("09:00")
  const [aviso, setAviso] = React.useState("2")

  async function crear() {
    if (!fecha) return toast.error("Elige la fecha.")
    const { error } = await createClient()
      .from("licitacion_eventos")
      .insert({
        licitacion_id: licitacionId,
        tipo,
        titulo: titulo.trim() || tipo,
        fecha: `${fecha}T${hora || "09:00"}:00-06:00`,
        recordar_dias: Math.min(60, Math.max(0, Number(aviso) || 0)),
      })
    if (error) return toast.error("No se pudo agregar.")
    await onCreada()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar fecha</DialogTitle>
          <DialogDescription>Por ejemplo una visita de campo, una cita en el módulo o la entrega de la fianza.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Tipo</FieldLabel>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoEvento)} items={TIPOS_EVENTO.map((t) => ({ value: t, label: t }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EVENTO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="ev-titulo">Descripción</FieldLabel>
            <Input id="ev-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Visita UHM Mexicali III" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="ev-fecha">Fecha</FieldLabel>
              <Input id="ev-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ev-hora">Hora</FieldLabel>
              <Input id="ev-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="ev-aviso">Avisar con</FieldLabel>
            <Input id="ev-aviso" inputMode="numeric" value={aviso} onChange={(e) => setAviso(e.target.value.replace(/\D/g, ""))} />
            <FieldDescription>Días de anticipación.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={crear}>Agregar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

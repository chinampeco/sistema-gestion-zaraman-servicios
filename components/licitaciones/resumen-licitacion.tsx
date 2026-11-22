"use client"

import * as React from "react"
import { AlertTriangle, Lightbulb, Pencil, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatoMoneda } from "@/lib/contratos"
import {
  ESTADOS_LICITACION,
  TIPOS_PROCEDIMIENTO,
  type EstadoLicitacion,
  type Licitacion,
  type PartidaLicitacion,
  type TipoProcedimiento,
} from "@/lib/licitaciones"
import { createClient } from "@/lib/supabase/client"
import type { DatosLicitacion } from "./use-licitacion"

function Lista({ titulo, icono, items, tono }: { titulo: string; icono: React.ReactNode; items: string[]; tono?: string }) {
  if (!items.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className={`flex items-center gap-2 text-base ${tono ?? ""}`}>
          {icono}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export function ResumenLicitacion({
  datos,
  puedeGestionar,
  onCambio,
}: {
  datos: DatosLicitacion
  puedeGestionar: boolean
  onCambio: () => Promise<void>
}) {
  const lic = datos.licitacion
  const [editar, setEditar] = React.useState(false)

  async function cambiarEstado(estado: EstadoLicitacion) {
    const { error } = await createClient().from("licitaciones").update({ estado }).eq("id", lic.id)
    if (error) return toast.error("No se pudo cambiar el estado.")
    await onCambio()
  }

  const fila = (etiqueta: string, valor: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span className="text-sm">{valor || "—"}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Datos del procedimiento</CardTitle>
            <CardDescription>{lic.objeto || "Sin objeto capturado"}</CardDescription>
          </div>
          {puedeGestionar && (
            <Button variant="outline" size="sm" onClick={() => setEditar(true)}>
              <Pencil data-icon="inline-start" />
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fila("Número", lic.numero)}
          {fila("Expediente", lic.expediente)}
          {fila("Dependencia", lic.dependencia)}
          {fila("Unidad compradora", lic.unidadCompradora)}
          {fila("Tipo", `${lic.tipoProcedimiento}${lic.caracter ? ` · ${lic.caracter}` : ""}`)}
          {fila(
            "Evaluación",
            `${lic.criterioEvaluacion || "—"}${lic.puntosTecnicosMax != null ? ` (técnico ${lic.puntosTecnicosMax} + económico ${lic.puntosEconomicosMax ?? "—"})` : ""}`,
          )}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Estado</span>
            {puedeGestionar ? (
              <Select
                value={lic.estado}
                onValueChange={(v) => void cambiarEstado(v as EstadoLicitacion)}
                items={ESTADOS_LICITACION.map((e) => ({ value: e, label: e }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_LICITACION.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="secondary">{lic.estado}</Badge>
            )}
          </div>
          {lic.montoAdjudicado != null && fila("Monto adjudicado (con IVA)", formatoMoneda(lic.montoAdjudicado))}
          {lic.notas && fila("Notas", lic.notas)}
        </CardContent>
      </Card>

      {lic.analisis.resumen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{lic.analisis.resumen}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Lista
          titulo="Para obtener la máxima puntuación"
          icono={<Lightbulb className="size-4 text-amber-500" />}
          items={lic.analisis.recomendaciones}
        />
        <Lista
          titulo="Causales de desechamiento"
          icono={<ShieldAlert className="size-4" />}
          tono="text-destructive"
          items={lic.analisis.causales_desechamiento}
        />
        <Lista titulo="Riesgos" icono={<AlertTriangle className="size-4 text-amber-600" />} items={lic.analisis.riesgos} />
        <Lista titulo="Cambios de la junta de aclaraciones" icono={<Pencil className="size-4" />} items={lic.analisis.cambios_junta} />
      </div>

      <PartidasLicitacion lic={lic} puedeGestionar={puedeGestionar} onCambio={onCambio} />

      {editar && (
        <EditarDatosDialog
          lic={lic}
          onClose={() => setEditar(false)}
          onGuardado={async () => {
            setEditar(false)
            await onCambio()
          }}
        />
      )}
    </div>
  )
}

function PartidasLicitacion({
  lic,
  puedeGestionar,
  onCambio,
}: {
  lic: Licitacion
  puedeGestionar: boolean
  onCambio: () => Promise<void>
}) {
  const [partidas, setPartidas] = React.useState(lic.partidas)
  React.useEffect(() => setPartidas(lic.partidas), [lic.partidas])
  if (!partidas.length) return null

  async function guardar(nuevas: PartidaLicitacion[]) {
    setPartidas(nuevas)
    const { error } = await createClient().from("licitaciones").update({ partidas: nuevas }).eq("id", lic.id)
    if (error) {
      toast.error("No se pudieron guardar las partidas.")
      await onCambio()
    }
  }

  const ofertadas = partidas.filter((p) => p.ofertar)
  const total = ofertadas.reduce((t, p) => t + (p.precio_ofertado ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Partidas</CardTitle>
        <CardDescription>
          {partidas.length} partidas · {ofertadas.length} a ofertar
          {total > 0 ? ` · ${formatoMoneda(total)} sin IVA` : ""}. Marca solo las que puedas cumplir en tiempo y lugar.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Descripción / ubicación</TableHead>
              <TableHead className="w-24">Ofertar</TableHead>
              <TableHead className="w-40">Precio sin IVA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partidas.map((p) => (
              <TableRow key={p.numero}>
                <TableCell>{p.numero}</TableCell>
                <TableCell className="max-w-md">
                  <div className="flex flex-col">
                    <span className="text-sm">{p.descripcion}</span>
                    {p.ubicacion && <span className="text-xs text-muted-foreground">{p.ubicacion}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.ofertar}
                    disabled={!puedeGestionar}
                    onCheckedChange={(v) => void guardar(partidas.map((x) => (x.numero === p.numero ? { ...x, ofertar: v } : x)))}
                    aria-label={`Ofertar partida ${p.numero}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    defaultValue={p.precio_ofertado ?? ""}
                    disabled={!puedeGestionar}
                    onBlur={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "")
                      const precio = v ? Number(v) : null
                      if (precio !== p.precio_ofertado) {
                        void guardar(partidas.map((x) => (x.numero === p.numero ? { ...x, precio_ofertado: precio } : x)))
                      }
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function EditarDatosDialog({
  lic,
  onClose,
  onGuardado,
}: {
  lic: Licitacion
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const [f, setF] = React.useState({
    numero: lic.numero,
    expediente: lic.expediente,
    dependencia: lic.dependencia,
    unidad_compradora: lic.unidadCompradora,
    objeto: lic.objeto,
    tipo_procedimiento: lic.tipoProcedimiento as TipoProcedimiento,
    caracter: lic.caracter,
    criterio_evaluacion: lic.criterioEvaluacion,
    notas: lic.notas,
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }))

  async function guardar() {
    const { error } = await createClient()
      .from("licitaciones")
      .update(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])))
      .eq("id", lic.id)
    if (error) {
      return toast.error(
        error.message.includes("licitaciones_numero_unico") ? "Ya existe otra licitación con ese número." : "No se pudo guardar.",
      )
    }
    await onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar datos</DialogTitle>
          <DialogDescription>Corrige lo que la IA no haya leído bien.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ed-num">Número</FieldLabel>
              <Input id="ed-num" value={f.numero} onChange={set("numero")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-exp">Expediente</FieldLabel>
              <Input id="ed-exp" value={f.expediente} onChange={set("expediente")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-dep">Dependencia</FieldLabel>
              <Input id="ed-dep" value={f.dependencia} onChange={set("dependencia")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-uc">Unidad compradora</FieldLabel>
              <Input id="ed-uc" value={f.unidad_compradora} onChange={set("unidad_compradora")} />
            </Field>
            <Field>
              <FieldLabel>Tipo</FieldLabel>
              <Select
                value={f.tipo_procedimiento}
                onValueChange={(v) => setF((x) => ({ ...x, tipo_procedimiento: v as TipoProcedimiento }))}
                items={TIPOS_PROCEDIMIENTO.map((t) => ({ value: t, label: t }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PROCEDIMIENTO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-car">Carácter</FieldLabel>
              <Input id="ed-car" value={f.caracter} onChange={set("caracter")} placeholder="Nacional, electrónica" />
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-crit">Criterio de evaluación</FieldLabel>
              <Input id="ed-crit" value={f.criterio_evaluacion} onChange={set("criterio_evaluacion")} placeholder="Puntos y porcentajes" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="ed-obj">Objeto</FieldLabel>
            <Textarea id="ed-obj" value={f.objeto} onChange={set("objeto")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ed-notas">Notas</FieldLabel>
            <Textarea id="ed-notas" value={f.notas} onChange={set("notas")} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

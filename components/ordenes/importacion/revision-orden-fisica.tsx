"use client"

import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { clave } from "@/lib/importacion-ordenes"
import type { OrdenRevisada } from "@/lib/importacion-ordenes-guardar"
import type { ActividadOrden, OrdenServicio, Tecnico } from "@/lib/types"

/** Equipo de una orden, con las claves para compararlo con la hoja. */
export interface EquipoDeOrden {
  id: string
  etiqueta: string
  claves: string[]
}

export const NUEVA = "__nueva__"
export const OMITIR = "__omitir__"
const SIN_TECNICO = "__sin__"

export interface Propuesta extends OrdenRevisada {
  key: string
  archivoNombre: string
  incluir: boolean
}

export function RevisionOrdenFisica({
  propuesta,
  onChange,
  onOrden,
  ordenes,
  tecnicos,
  equipos,
  actividades,
  clavesLeidas,
}: {
  propuesta: Propuesta
  onChange: (p: Propuesta) => void
  /** Cambio de orden destino (recarga sus equipos y actividades). */
  onOrden: (valor: string) => void
  ordenes: OrdenServicio[]
  tecnicos: Tecnico[]
  /** Equipos de la orden elegida (o candidatos de la orden nueva). */
  equipos: EquipoDeOrden[] | undefined
  actividades: ActividadOrden[]
  clavesLeidas: Set<string>
}) {
  const p = propuesta
  const l = p.leida
  const valorOrden = !p.incluir ? OMITIR : p.ordenId ?? (p.nueva ? NUEVA : OMITIR)
  const opcionesOrden = [
    ...(p.nueva ? [{ value: NUEVA, label: `Crear la orden de ${p.nueva.referencia || "la partida"}` }] : []),
    ...ordenes.map((o) => ({
      value: o.id,
      label: `${o.folio}${o.referencia ? ` · ${o.referencia}` : ""} · ${o.estado}`,
    })),
    { value: OMITIR, label: "No registrar esta hoja" },
  ]
  const opcionesTecnico = [
    { value: SIN_TECNICO, label: "Sin técnico" },
    ...tecnicos.map((t) => ({ value: t.id, label: `${t.nombre}${t.activo ? "" : " (inactivo)"}` })),
  ]
  const noEncontrados = l.equipos.filter((e) => {
    const ks = [e.serie, e.inventario].map(clave).filter((k) => k.length >= 4)
    return ks.length > 0 && !(equipos ?? []).some((q) => q.claves.some((c) => ks.includes(c)))
  })

  return (
    <Card className={p.incluir ? undefined : "opacity-60"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {l.referencia || l.folio || "Orden sin número"}
          {l.firmada ? (
            <Badge variant="secondary"><CheckCircle2 data-icon="inline-start" />Firmada</Badge>
          ) : (
            <Badge variant="outline"><AlertTriangle data-icon="inline-start" />Sin firma de recibido</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {p.archivoNombre}
          {l.numero_contrato ? ` · Contrato ${l.numero_contrato}` : ""}
          {l.partida ? ` · Partida ${l.partida}` : ""}
          {l.instalacion ? ` · ${l.instalacion}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2">
          <FieldLabel>Orden en el sistema</FieldLabel>
          <Select value={valorOrden} onValueChange={(v) => onOrden(v as string)} items={opcionesOrden}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {opcionesOrden.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!p.ordenId && !p.nueva && p.incluir === false && (
            <FieldDescription>No se encontró una orden con esa referencia. Elige una de la lista o déjala sin registrar.</FieldDescription>
          )}
        </Field>

        {p.incluir && (
          <>
            <Field>
              <FieldLabel>Técnico</FieldLabel>
              <Select
                value={p.tecnicoId ?? SIN_TECNICO}
                onValueChange={(v) => {
                  const t = tecnicos.find((x) => x.id === v)
                  onChange({ ...p, tecnicoId: t?.id ?? null, tecnicoNombre: t?.nombre ?? "" })
                }}
                items={opcionesTecnico}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {opcionesTecnico.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {l.tecnicos.length > 0 && <FieldDescription>En la hoja: {l.tecnicos.join(", ")}</FieldDescription>}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${p.key}-fecha`}>Fecha de cierre</FieldLabel>
              <Input
                id={`${p.key}-fecha`}
                type="date"
                value={p.fechaCierre}
                onChange={(e) => onChange({ ...p, fechaCierre: e.target.value })}
              />
              {!l.fecha && <FieldDescription>No se leyó la fecha en la hoja.</FieldDescription>}
            </Field>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium">Equipos realizados</span>
              {equipos === undefined ? (
                <span className="text-sm text-muted-foreground">Cargando equipos…</span>
              ) : equipos.length === 0 ? (
                <span className="text-sm text-muted-foreground">La orden no tiene equipos ligados.</span>
              ) : (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {equipos.map((e) => {
                    const enHoja = e.claves.some((c) => clavesLeidas.has(c))
                    return (
                      <li key={e.id} className="flex items-center gap-3 p-2 text-sm">
                        <Switch
                          checked={p.equipos[e.id] ?? false}
                          onCheckedChange={(v) => onChange({ ...p, equipos: { ...p.equipos, [e.id]: v } })}
                          aria-label={`Realizado: ${e.etiqueta}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{e.etiqueta}</span>
                        {enHoja ? <Badge variant="secondary">En la hoja</Badge> : <Badge variant="outline">No aparece</Badge>}
                      </li>
                    )
                  })}
                </ul>
              )}
              {noEncontrados.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  En la hoja hay {noEncontrados.length} equipo(s) que no están en esta orden:{" "}
                  {noEncontrados.map((e) => e.inventario || e.serie).join(", ")}.
                </p>
              )}
            </div>

            {actividades.length > 0 && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <span className="text-sm font-medium">Actividades realizadas</span>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {actividades.map((a) => (
                    <li key={a.numero} className="flex items-center gap-3 p-2 text-sm">
                      <Switch
                        checked={p.actividades[a.numero] ?? false}
                        onCheckedChange={(v) => onChange({ ...p, actividades: { ...p.actividades, [a.numero]: v } })}
                        aria-label={`Actividad ${a.numero} realizada`}
                      />
                      <span className="min-w-0 flex-1">{a.numero}. {a.titulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${p.key}-obs`}>Se agrega a las observaciones de la orden</FieldLabel>
              <Textarea
                id={`${p.key}-obs`}
                rows={3}
                value={p.observaciones}
                onChange={(e) => onChange({ ...p, observaciones: e.target.value })}
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { CamposUbicacion } from "@/components/ubicacion/campos-ubicacion"
import { CARACTERES, PROCEDIMIENTOS, TIPOS_DOCUMENTO, formatoMoneda, type TipoDocumento } from "@/lib/contratos"
import {
  FORMAS_GARANTIA,
  TIPOS_GARANTIA,
  type ExtraccionContrato,
  type ExtraccionEquipo,
  type ExtraccionGarantia,
  type ExtraccionPartida,
} from "@/lib/importacion-contratos"
import type { Cliente, Ubicacion } from "@/lib/types"

const NUEVO = "__nuevo__"

export interface SeleccionCliente {
  clienteId: string | null
  nuevo: { nombre: string; rfc: string; direccion: string }
}

// Pantalla de revisión: todo lo que leyó la IA, editable antes de guardar.
export function RevisionImportacion({
  valor,
  onChange,
  archivos,
  clientes,
  cliente,
  onCliente,
  sugerenciasUbicacion,
}: {
  valor: ExtraccionContrato
  onChange: (v: ExtraccionContrato) => void
  archivos: { indice: number; nombre: string }[]
  clientes: Cliente[]
  cliente: SeleccionCliente
  onCliente: (c: SeleccionCliente) => void
  sugerenciasUbicacion: Ubicacion[]
}) {
  const c = valor.contrato
  const setContrato = <K extends keyof ExtraccionContrato["contrato"]>(k: K, v: ExtraccionContrato["contrato"][K]) =>
    onChange({ ...valor, contrato: { ...c, [k]: v } })
  const setPartida = (i: number, cambios: Partial<ExtraccionPartida>) =>
    onChange({ ...valor, partidas: valor.partidas.map((p, j) => (j === i ? { ...p, ...cambios } : p)) })
  const setGarantia = (i: number, cambios: Partial<ExtraccionGarantia>) =>
    onChange({ ...valor, garantias: valor.garantias.map((g, j) => (j === i ? { ...g, ...cambios } : g)) })

  const sumaPartidas = valor.partidas.reduce((s, p) => s + p.cantidad * p.precio_unitario, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Dependencia */}
      <Card>
        <CardHeader>
          <CardTitle>Dependencia (cliente)</CardTitle>
          <CardDescription>
            Leído: <strong>{valor.dependencia.nombre || "—"}</strong>
            {valor.dependencia.rfc ? ` · RFC ${valor.dependencia.rfc}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <FieldLabel>Registrar el contrato a nombre de</FieldLabel>
            <Select
              value={cliente.clienteId ?? NUEVO}
              onValueChange={(v) => onCliente({ ...cliente, clienteId: v === NUEVO ? null : (v as string) })}
              items={[
                { value: NUEVO, label: `Nueva dependencia: ${cliente.nuevo.nombre || "(sin nombre)"}` },
                ...clientes.map((x) => ({ value: x.id, label: x.nombre })),
              ]}
            >
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NUEVO}>Nueva dependencia: {cliente.nuevo.nombre || "(sin nombre)"}</SelectItem>
                {clientes.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nombre}{x.tipo === "Gobierno" ? " · Gobierno" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {cliente.clienteId === null && (
            <>
              <Field>
                <FieldLabel htmlFor="imp-dep-nombre">Nombre de la dependencia</FieldLabel>
                <Input id="imp-dep-nombre" value={cliente.nuevo.nombre} onChange={(e) => onCliente({ ...cliente, nuevo: { ...cliente.nuevo, nombre: e.target.value } })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="imp-dep-rfc">RFC</FieldLabel>
                <Input id="imp-dep-rfc" className="uppercase" value={cliente.nuevo.rfc} onChange={(e) => onCliente({ ...cliente, nuevo: { ...cliente.nuevo, rfc: e.target.value } })} />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="imp-dep-dom">Domicilio</FieldLabel>
                <Input id="imp-dep-dom" value={cliente.nuevo.direccion} onChange={(e) => onCliente({ ...cliente, nuevo: { ...cliente.nuevo, direccion: e.target.value } })} />
              </Field>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contrato */}
      <Card>
        <CardHeader><CardTitle>Contrato</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Texto id="imp-num" etiqueta="Número de contrato" valor={c.numero_contrato} onChange={(v) => setContrato("numero_contrato", v)} />
          <Field>
            <FieldLabel>Procedimiento</FieldLabel>
            <Select value={c.procedimiento} onValueChange={(v) => setContrato("procedimiento", v as typeof c.procedimiento)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{PROCEDIMIENTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Carácter</FieldLabel>
            <Select value={c.caracter} onValueChange={(v) => setContrato("caracter", v as typeof c.caracter)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{CARACTERES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="imp-objeto">Objeto</FieldLabel>
            <Textarea id="imp-objeto" rows={2} value={c.objeto} onChange={(e) => setContrato("objeto", e.target.value)} />
          </Field>
          <Texto id="imp-area" etiqueta="Área requirente" valor={c.area_requirente} onChange={(v) => setContrato("area_requirente", v)} />
          <Texto id="imp-admin" etiqueta="Administrador del contrato" valor={c.administrador_nombre} onChange={(v) => setContrato("administrador_nombre", v)} />
          <Texto id="imp-admincargo" etiqueta="Cargo del administrador" valor={c.administrador_cargo} onChange={(v) => setContrato("administrador_cargo", v)} />
          <Fecha id="imp-firma" etiqueta="Fecha de firma" valor={c.fecha_firma} onChange={(v) => setContrato("fecha_firma", v)} />
          <Fecha id="imp-vini" etiqueta="Vigencia desde" valor={c.vigencia_inicio} onChange={(v) => setContrato("vigencia_inicio", v)} />
          <Fecha id="imp-vfin" etiqueta="Vigencia hasta" valor={c.vigencia_fin} onChange={(v) => setContrato("vigencia_fin", v)} />
          <Fecha id="imp-limite" etiqueta="Fecha límite de entrega" valor={c.fecha_limite_entrega} onChange={(v) => setContrato("fecha_limite_entrega", v)} />
          <Numero id="imp-sub" etiqueta="Subtotal" valor={c.subtotal} onChange={(v) => setContrato("subtotal", v ?? 0)} />
          <Numero id="imp-iva" etiqueta="IVA" valor={c.iva} onChange={(v) => setContrato("iva", v ?? 0)} />
          <Numero id="imp-total" etiqueta="Total" valor={c.total} onChange={(v) => setContrato("total", v ?? 0)} />
          <Numero id="imp-gc" etiqueta="Garantía de cumplimiento (%)" valor={c.garantia_cumplimiento_pct} onChange={(v) => setContrato("garantia_cumplimiento_pct", v)} />
          <Numero id="imp-gcal" etiqueta="Garantía de calidad (meses)" valor={c.garantia_calidad_meses} onChange={(v) => setContrato("garantia_calidad_meses", v)} />
          <Numero id="imp-pago" etiqueta="Plazo de pago (días hábiles)" valor={c.plazo_pago_dias_habiles} onChange={(v) => setContrato("plazo_pago_dias_habiles", v)} />
          <Numero id="imp-pena" etiqueta="Pena diaria (%)" valor={c.pena_diaria_pct} onChange={(v) => setContrato("pena_diaria_pct", v)} />
          <Numero id="imp-penamax" etiqueta="Pena máxima (%)" valor={c.pena_maxima_pct} onChange={(v) => setContrato("pena_maxima_pct", v)} />
          <Texto id="imp-suf" etiqueta="Suficiencia presupuestal" valor={c.suficiencia_presupuestal} onChange={(v) => setContrato("suficiencia_presupuestal", v)} />
          <Field className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="imp-lugar">Lugar de ejecución</FieldLabel>
            <Input id="imp-lugar" value={c.lugar_ejecucion} onChange={(e) => setContrato("lugar_ejecucion", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Partidas */}
      <Card>
        <CardHeader>
          <CardTitle>Partidas ({valor.partidas.length})</CardTitle>
          <CardDescription>
            Suma {formatoMoneda(sumaPartidas, c.moneda)}
            {valor.partidas.length > 0 && Math.abs(sumaPartidas - c.subtotal) > 0.5
              ? ` · no coincide con el subtotal (${formatoMoneda(c.subtotal, c.moneda)}); revisa precios`
              : ""}
            . Se generará una orden de servicio por partida con sus equipos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {valor.partidas.length === 0 && (
            <p className="text-sm text-muted-foreground">La IA no encontró partidas. Podrás agregarlas después en el contrato.</p>
          )}
          {valor.partidas.map((p, i) => (
            <PartidaRevision
              key={i}
              partida={p}
              onChange={(cambios) => setPartida(i, cambios)}
              onQuitar={() => onChange({ ...valor, partidas: valor.partidas.filter((_, j) => j !== i) })}
              sugerencias={sugerenciasUbicacion}
            />
          ))}
        </CardContent>
      </Card>

      {/* Garantías */}
      <Card>
        <CardHeader>
          <CardTitle>Garantías ({valor.garantias.length})</CardTitle>
          <CardDescription>Fianzas y demás garantías que pide el contrato. Si subiste la póliza, ya trae sus datos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {valor.garantias.map((g, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field>
                <FieldLabel>Tipo</FieldLabel>
                <Select value={g.tipo} onValueChange={(v) => setGarantia(i, { tipo: v as typeof g.tipo })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_GARANTIA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Forma</FieldLabel>
                <Select value={g.forma} onValueChange={(v) => setGarantia(i, { forma: v as typeof g.forma })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_GARANTIA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Numero id={`imp-g${i}-pct`} etiqueta="Porcentaje" valor={g.porcentaje} onChange={(v) => setGarantia(i, { porcentaje: v })} />
              <Numero id={`imp-g${i}-monto`} etiqueta="Monto" valor={g.monto} onChange={(v) => setGarantia(i, { monto: v })} />
              <Texto id={`imp-g${i}-afz`} etiqueta="Afianzadora" valor={g.afianzadora} onChange={(v) => setGarantia(i, { afianzadora: v })} />
              <Texto id={`imp-g${i}-pol`} etiqueta="Número de póliza" valor={g.numero_poliza} onChange={(v) => setGarantia(i, { numero_poliza: v })} />
              <Texto id={`imp-g${i}-folio`} etiqueta="Folio" valor={g.folio} onChange={(v) => setGarantia(i, { folio: v })} />
              <Texto id={`imp-g${i}-linea`} etiqueta="Línea de validación" valor={g.linea_validacion} onChange={(v) => setGarantia(i, { linea_validacion: v })} />
              <Fecha id={`imp-g${i}-exp`} etiqueta="Fecha de expedición" valor={g.fecha_expedicion} onChange={(v) => setGarantia(i, { fecha_expedicion: v })} />
              <Fecha id={`imp-g${i}-lim`} etiqueta="Entregar a más tardar" valor={g.fecha_limite_entrega} onChange={(v) => setGarantia(i, { fecha_limite_entrega: v })} />
              <Fecha id={`imp-g${i}-vig`} etiqueta="Vigente hasta" valor={g.vigencia_hasta} onChange={(v) => setGarantia(i, { vigencia_hasta: v })} />
              <Field>
                <FieldLabel>Archivo de la póliza</FieldLabel>
                <Select
                  value={String(g.archivo_poliza)}
                  onValueChange={(v) => setGarantia(i, { archivo_poliza: Number(v) })}
                  items={[{ value: "-1", label: "No se subió" }, ...archivos.map((a) => ({ value: String(a.indice), label: a.nombre }))]}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">No se subió</SelectItem>
                    {archivos.map((a) => <SelectItem key={a.indice} value={String(a.indice)}>{a.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field orientation="horizontal" className="items-center">
                <Switch id={`imp-g${i}-req`} checked={g.requerida} onCheckedChange={(v) => setGarantia(i, { requerida: v })} />
                <FieldLabel htmlFor={`imp-g${i}-req`}>Requerida</FieldLabel>
              </Field>
              <div className="flex items-end justify-end lg:col-span-3">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => onChange({ ...valor, garantias: valor.garantias.filter((_, j) => j !== i) })}>
                  <Trash2 data-icon="inline-start" />
                  Quitar garantía
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              onChange({
                ...valor,
                garantias: [
                  ...valor.garantias,
                  { tipo: "Cumplimiento", forma: "Póliza de fianza", requerida: true, porcentaje: c.garantia_cumplimiento_pct, monto: c.garantia_cumplimiento_pct != null ? Math.round(c.subtotal * c.garantia_cumplimiento_pct) / 100 : null, divisible: true, beneficiaria: "Tesorería de la Federación", afianzadora: "", numero_poliza: "", folio: "", linea_validacion: "", fecha_expedicion: "", fecha_limite_entrega: "", vigencia_hasta: "", archivo_poliza: -1 },
                ],
              })
            }
          >
            <Plus data-icon="inline-start" />
            Agregar garantía
          </Button>
        </CardContent>
      </Card>

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos para el expediente</CardTitle>
          <CardDescription>Se guardarán en el expediente privado del contrato con este tipo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {archivos.map((a) => {
            const doc = valor.documentos.find((d) => d.indice === a.indice)
            return (
              <div key={a.indice} className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center">
                <span className="min-w-0 flex-1 truncate text-sm" title={a.nombre}>{a.nombre}</span>
                <Select
                  value={doc?.tipo ?? "Otro"}
                  onValueChange={(v) =>
                    onChange({
                      ...valor,
                      documentos: valor.documentos.map((d) => (d.indice === a.indice ? { ...d, tipo: v as TipoDocumento } : d)),
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_DOCUMENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function PartidaRevision({
  partida: p,
  onChange,
  onQuitar,
  sugerencias,
}: {
  partida: ExtraccionPartida
  onChange: (cambios: Partial<ExtraccionPartida>) => void
  onQuitar: () => void
  sugerencias: Ubicacion[]
}) {
  const setEquipo = (i: number, cambios: Partial<ExtraccionEquipo>) =>
    onChange({ equipos: p.equipos.map((e, j) => (j === i ? { ...e, ...cambios } : e)) })
  const unidades = p.equipos.reduce((s, e) => s + (e.serie || e.inventario ? 1 : e.cantidad), 0)

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge>Partida {p.numero}</Badge>
          {p.ficha_tecnica && <Badge variant="outline">Ficha técnica {p.ficha_tecnica}</Badge>}
        </div>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onQuitar}>
          <Trash2 data-icon="inline-start" />
          Quitar partida
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field className="sm:col-span-4">
          <FieldLabel htmlFor={`imp-p${p.numero}-desc`}>Descripción</FieldLabel>
          <Input id={`imp-p${p.numero}-desc`} value={p.descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} />
        </Field>
        <Numero id={`imp-p${p.numero}-cant`} etiqueta="Cantidad" valor={p.cantidad} onChange={(v) => onChange({ cantidad: v ?? 1 })} />
        <Texto id={`imp-p${p.numero}-uni`} etiqueta="Unidad" valor={p.unidad} onChange={(v) => onChange({ unidad: v })} />
        <Numero id={`imp-p${p.numero}-pu`} etiqueta="Precio unitario" valor={p.precio_unitario} onChange={(v) => onChange({ precio_unitario: v ?? 0 })} />
        <Texto id={`imp-p${p.numero}-cucop`} etiqueta="CUCoP" valor={p.cucop} onChange={(v) => onChange({ cucop: v })} />
        <Field className="sm:col-span-4">
          <FieldLabel htmlFor={`imp-p${p.numero}-alc`}>Alcance</FieldLabel>
          <Textarea id={`imp-p${p.numero}-alc`} rows={3} value={p.alcance} onChange={(e) => onChange({ alcance: e.target.value })} />
        </Field>
        <Field className="sm:col-span-4">
          <FieldLabel htmlFor={`imp-p${p.numero}-lugar`}>Lugar de ejecución</FieldLabel>
          <Input id={`imp-p${p.numero}-lugar`} value={p.lugar_ejecucion} onChange={(e) => onChange({ lugar_ejecucion: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <CamposUbicacion
          value={p}
          onChange={(u) => onChange(u)}
          sugerencias={sugerencias}
          requerido
          descripcion="Si el contrato no menciona región o zona, captúralas aquí: se copian a los equipos y la orden."
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Equipos · se registrarán {unidades}</span>
          <Button variant="outline" size="sm" onClick={() => onChange({ equipos: [...p.equipos, { descripcion: "", cantidad: 1, marca: "", modelo: "", serie: "", inventario: "" }] })}>
            <Plus data-icon="inline-start" />
            Agregar
          </Button>
        </div>
        {p.equipos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin equipos en la ficha.</p>
        ) : (
          p.equipos.map((e, i) => (
            <div key={i} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-12">
              <Input aria-label="Descripción" className="col-span-2 sm:col-span-3" value={e.descripcion} onChange={(ev) => setEquipo(i, { descripcion: ev.target.value })} placeholder="Descripción" />
              <Input aria-label="Cantidad" type="number" min={1} className="sm:col-span-1" value={e.cantidad} onChange={(ev) => setEquipo(i, { cantidad: Math.max(1, Number(ev.target.value) || 1) })} />
              <Input aria-label="Marca" className="sm:col-span-2" value={e.marca} onChange={(ev) => setEquipo(i, { marca: ev.target.value })} placeholder="Marca" />
              <Input aria-label="Modelo" className="sm:col-span-2" value={e.modelo} onChange={(ev) => setEquipo(i, { modelo: ev.target.value })} placeholder="Modelo" />
              <Input aria-label="Serie" className="sm:col-span-1" value={e.serie} onChange={(ev) => setEquipo(i, { serie: ev.target.value })} placeholder="Serie" />
              <div className="col-span-2 flex gap-1 sm:col-span-3">
                <Input aria-label="Número de inventario" className="font-mono text-xs" value={e.inventario} onChange={(ev) => setEquipo(i, { inventario: ev.target.value })} placeholder="No. inventario / S.I.L." />
                <Button variant="ghost" size="icon-sm" aria-label="Quitar equipo" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => onChange({ equipos: p.equipos.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {p.actividades.length > 0 && (
        <details className="rounded-lg bg-muted/30 p-2 text-sm">
          <summary className="cursor-pointer font-medium">Actividades de la ficha ({p.actividades.length})</summary>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
            {p.actividades.map((a) => (
              <li key={a.numero}>
                {a.titulo}
                {a.detalle.length > 0 && (
                  <ul className="list-[lower-alpha] pl-5 text-muted-foreground">
                    {a.detalle.map((d, k) => <li key={k}>{d}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

function Texto({ id, etiqueta, valor, onChange }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input id={id} value={valor} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

function Fecha({ id, etiqueta, valor, onChange }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input id={id} type="date" value={valor} onChange={(e) => onChange(e.target.value)} />
      {!valor && <FieldDescription>No se encontró en los documentos.</FieldDescription>}
    </Field>
  )
}

function Numero({ id, etiqueta, valor, onChange }: { id: string; etiqueta: string; valor: number | null; onChange: (v: number | null) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
      <Input id={id} type="number" min={0} step="any" value={valor ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
    </Field>
  )
}

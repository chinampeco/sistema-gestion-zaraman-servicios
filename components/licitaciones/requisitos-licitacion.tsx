"use client"

import * as React from "react"
import { AlertTriangle, Plus, Trash2 } from "lucide-react"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { formatFecha } from "@/lib/format"
import {
  CATEGORIAS_REQUISITO,
  ESTADOS_REQUISITO,
  type CategoriaRequisito,
  type EstadoRequisito,
  type RequisitoLicitacion,
} from "@/lib/licitaciones"
import { createClient } from "@/lib/supabase/client"
import type { DatosLicitacion } from "./use-licitacion"

const COLOR_ESTADO: Record<EstadoRequisito, "warning" | "info" | "success" | "secondary"> = {
  Pendiente: "warning",
  "En proceso": "info",
  Listo: "success",
  "No aplica": "secondary",
}

export function RequisitosLicitacion({
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
  const { requisitos, documentos, documentosEmpresa, eventos } = datos
  const [soloPendientes, setSoloPendientes] = React.useState(false)
  const [nuevo, setNuevo] = React.useState(false)
  const [local, setLocal] = React.useState(requisitos)
  React.useEffect(() => setLocal(requisitos), [requisitos])

  // Fecha contra la que se revisa la vigencia de los documentos de la empresa.
  const fechaClave =
    eventos.find((e) => e.tipo === "Firma de contrato")?.fecha ??
    eventos.find((e) => e.tipo === "Presentación y apertura")?.fecha ??
    null

  const aplicables = local.filter((r) => r.estado !== "No aplica")
  const listos = aplicables.filter((r) => r.estado === "Listo").length
  const criticosPendientes = aplicables.filter((r) => r.desecha && r.estado !== "Listo").length

  async function guardar(r: RequisitoLicitacion, cambios: Record<string, unknown>, optimista?: Partial<RequisitoLicitacion>) {
    if (optimista) setLocal((l) => l.map((x) => (x.id === r.id ? { ...x, ...optimista } : x)))
    const { error } = await createClient().from("licitacion_requisitos").update(cambios).eq("id", r.id)
    if (error) {
      toast.error("No se pudo guardar el cambio.")
      await onCambio()
    }
  }

  async function eliminar(r: RequisitoLicitacion) {
    if (!window.confirm("¿Eliminar este requisito?")) return
    const { error } = await createClient().from("licitacion_requisitos").delete().eq("id", r.id)
    if (error) return toast.error("No se pudo eliminar.")
    await onCambio()
  }

  const docItems = [
    { value: "ninguno", label: "Sin documento" },
    ...documentos.map((d) => ({ value: `l:${d.id}`, label: `${d.tipo}: ${d.nombreArchivo}` })),
    ...documentosEmpresa.map((d) => ({
      value: `e:${d.id}`,
      label: `Expediente: ${d.tipo}${d.vigenteHasta ? ` (vence ${formatFecha(d.vigenteHasta)})` : ""}`,
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span>
            <strong>{listos}</strong> de {aplicables.length} requisitos listos
          </span>
          {criticosPendientes > 0 && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="size-4" />
              {criticosPendientes} pendiente(s) que desechan la propuesta
            </span>
          )}
        </div>
        <Progress value={aplicables.length ? (listos / aplicables.length) * 100 : 0} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="solo-pend" checked={soloPendientes} onCheckedChange={setSoloPendientes} />
          <Label htmlFor="solo-pend">Solo lo que falta</Label>
        </div>
        {puedeGestionar && (
          <Button variant="outline" size="sm" onClick={() => setNuevo(true)}>
            <Plus data-icon="inline-start" />
            Agregar requisito
          </Button>
        )}
      </div>

      {local.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin requisitos todavía. Sube la convocatoria en “Documentos” y léela con IA para armar la lista completa.
        </p>
      )}

      {CATEGORIAS_REQUISITO.map((cat) => {
        const grupo = local.filter((r) => r.categoria === cat && (!soloPendientes || (r.estado !== "Listo" && r.estado !== "No aplica")))
        if (!grupo.length) return null
        return (
          <section key={cat} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{cat}</h3>
            {grupo.map((r) => {
              const docEmp = r.empresaDocumentoId ? documentosEmpresa.find((d) => d.id === r.empresaDocumentoId) : null
              const vencido = docEmp?.vigenteHasta && fechaClave && docEmp.vigenteHasta < fechaClave.slice(0, 10)
              const valorDoc = r.documentoId ? `l:${r.documentoId}` : r.empresaDocumentoId ? `e:${r.empresaDocumentoId}` : "ninguno"
              return (
                <div
                  key={r.id}
                  className={`flex flex-col gap-2 rounded-lg border p-3 ${r.desecha && r.estado !== "Listo" && r.estado !== "No aplica" ? "border-destructive/40" : ""}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm">{r.descripcion}</span>
                      <div className="flex flex-wrap gap-1">
                        {r.numeral && <Badge variant="outline">Num. {r.numeral}</Badge>}
                        {r.formato && <Badge variant="outline">{r.formato}</Badge>}
                        {r.desecha && <Badge variant="destructive">Desecha si falta</Badge>}
                        {r.puntosMax != null && <Badge variant="info">{r.puntosMax} pts</Badge>}
                        {!r.obligatorio && <Badge variant="secondary">Opcional</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {puedeGestionar ? (
                        <Select
                          value={r.estado}
                          onValueChange={(v) => void guardar(r, { estado: v }, { estado: v as EstadoRequisito })}
                          items={ESTADOS_REQUISITO.map((e) => ({ value: e, label: e }))}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ESTADOS_REQUISITO.map((e) => (
                              <SelectItem key={e} value={e}>
                                {e}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={COLOR_ESTADO[r.estado]}>{r.estado}</Badge>
                      )}
                      {puedeEliminar && (
                        <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => eliminar(r)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                  {puedeGestionar && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={valorDoc}
                        onValueChange={(v) => {
                          const s = (v as string) ?? "ninguno"
                          void guardar(
                            r,
                            {
                              documento_id: s.startsWith("l:") ? s.slice(2) : null,
                              empresa_documento_id: s.startsWith("e:") ? s.slice(2) : null,
                            },
                            {
                              documentoId: s.startsWith("l:") ? s.slice(2) : null,
                              empresaDocumentoId: s.startsWith("e:") ? s.slice(2) : null,
                            },
                          )
                        }}
                        items={docItems}
                      >
                        <SelectTrigger className="sm:w-80">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {docItems.map((d) => (
                            <SelectItem key={d.value} value={d.value}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        defaultValue={r.notas}
                        placeholder="Notas / responsable"
                        onBlur={(e) => {
                          if (e.target.value !== r.notas) void guardar(r, { notas: e.target.value }, { notas: e.target.value })
                        }}
                      />
                    </div>
                  )}
                  {vencido && (
                    <span className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="size-3.5" />
                      El documento del expediente vence el {formatFecha(docEmp!.vigenteHasta)}, antes de la fecha clave de la
                      licitación. Sube uno actualizado.
                    </span>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      {nuevo && (
        <NuevoRequisitoDialog
          licitacionId={datos.licitacion.id}
          orden={local.reduce((m, r) => Math.max(m, r.orden), 0) + 1}
          onClose={() => setNuevo(false)}
          onCreado={async () => {
            setNuevo(false)
            await onCambio()
          }}
        />
      )}
    </div>
  )
}

function NuevoRequisitoDialog({
  licitacionId,
  orden,
  onClose,
  onCreado,
}: {
  licitacionId: string
  orden: number
  onClose: () => void
  onCreado: () => Promise<void>
}) {
  const [categoria, setCategoria] = React.useState<CategoriaRequisito>("Legal y administrativo")
  const [descripcion, setDescripcion] = React.useState("")
  const [numeral, setNumeral] = React.useState("")
  const [formato, setFormato] = React.useState("")
  const [desecha, setDesecha] = React.useState(false)
  const [puntos, setPuntos] = React.useState("")

  async function crear() {
    if (!descripcion.trim()) return toast.error("Describe el requisito.")
    const { error } = await createClient()
      .from("licitacion_requisitos")
      .insert({
        licitacion_id: licitacionId,
        categoria,
        descripcion: descripcion.trim(),
        numeral: numeral.trim(),
        formato: formato.trim(),
        desecha,
        puntos_max: puntos ? Number(puntos) : null,
        orden,
      })
    if (error) return toast.error("No se pudo agregar.")
    await onCreado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar requisito</DialogTitle>
          <DialogDescription>Algo que pida la convocatoria o la junta de aclaraciones y no esté en la lista.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Categoría</FieldLabel>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaRequisito)} items={CATEGORIAS_REQUISITO.map((c) => ({ value: c, label: c }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_REQUISITO.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="req-desc">Descripción</FieldLabel>
            <Textarea id="req-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="req-num">Numeral</FieldLabel>
              <Input id="req-num" value={numeral} onChange={(e) => setNumeral(e.target.value)} placeholder="9.5.6" />
            </Field>
            <Field>
              <FieldLabel htmlFor="req-for">Formato</FieldLabel>
              <Input id="req-for" value={formato} onChange={(e) => setFormato(e.target.value)} placeholder="Formato 3" />
            </Field>
            <Field>
              <FieldLabel htmlFor="req-pts">Puntos</FieldLabel>
              <Input id="req-pts" inputMode="decimal" value={puntos} onChange={(e) => setPuntos(e.target.value.replace(/[^0-9.]/g, ""))} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="req-desecha" checked={desecha} onCheckedChange={setDesecha} />
            <Label htmlFor="req-desecha">Si falta, desechan la propuesta</Label>
          </div>
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

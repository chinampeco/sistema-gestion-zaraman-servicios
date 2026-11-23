"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Plus, Printer, Save, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { useCurriculum, type DatosCurriculum } from "@/components/curriculum/use-curriculum"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatoMoneda } from "@/lib/contratos"
import {
  periodo,
  resumirExperiencia,
  type CurriculumEmpresa,
  type ExperienciaExterna,
} from "@/lib/curriculum"
import { puedeGestionarContratos } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

const lineas = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean)

interface LecturaCv {
  semblanza: string
  especialidades: string[]
  infraestructura: string
  certificaciones: string[]
  experiencia: ExperienciaExterna[]
  advertencias: string[]
}

export default function CurriculumPage() {
  const { usuarioActual, empresaActiva } = useStore()
  const puedeEditar = puedeGestionarContratos(usuarioActual.rol)
  const { datos, recargar } = useCurriculum(empresaActiva?.id)

  return (
    <>
      <PageHeader
        title="Currículum de la empresa"
        description={`Presentación y experiencia de ${empresaActiva?.nombreComercial ?? "la empresa"} para licitaciones y ComprasMX.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/documentos-empresa" />} nativeButton={false}>
              <ArrowLeft data-icon="inline-start" />
              Documentos
            </Button>
            <Button render={<Link href="/documentos-empresa/curriculum/imprimir" />} nativeButton={false}>
              <Printer data-icon="inline-start" />
              Imprimir / PDF
            </Button>
          </div>
        }
      />
      {!datos ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <Contenido datos={datos} puedeEditar={puedeEditar} empresaId={empresaActiva!.id} onCambio={recargar} />
      )}
    </>
  )
}

function Contenido({
  datos,
  puedeEditar,
  empresaId,
  onCambio,
}: {
  datos: DatosCurriculum
  puedeEditar: boolean
  empresaId: string
  onCambio: () => Promise<void>
}) {
  const cv = datos.curriculum
  const [f, setF] = React.useState({
    semblanza: cv.semblanza,
    especialidades: cv.especialidades.join("\n"),
    infraestructura: cv.infraestructura,
    certificaciones: cv.certificaciones.join("\n"),
  })
  React.useEffect(() => {
    setF({
      semblanza: cv.semblanza,
      especialidades: cv.especialidades.join("\n"),
      infraestructura: cv.infraestructura,
      certificaciones: cv.certificaciones.join("\n"),
    })
  }, [cv])
  const [guardando, setGuardando] = React.useState(false)
  const [leyendo, setLeyendo] = React.useState(false)
  const [lectura, setLectura] = React.useState<LecturaCv | null>(null)
  const [editando, setEditando] = React.useState<{ indice: number | null; valor: ExperienciaExterna } | null>(null)
  const resumen = resumirExperiencia(datos.experiencia)

  async function guardar(cambios: Partial<Record<string, unknown>>, aviso = "Currículum guardado.") {
    setGuardando(true)
    const { error } = await createClient()
      .from("empresa_curriculum")
      .upsert({ empresa_id: empresaId, ...cambios }, { onConflict: "empresa_id" })
    setGuardando(false)
    if (error) {
      toast.error("No se pudo guardar el currículum.")
      return false
    }
    toast.success(aviso)
    await onCambio()
    return true
  }

  const guardarPresentacion = () =>
    guardar({
      semblanza: f.semblanza.trim(),
      especialidades: lineas(f.especialidades),
      infraestructura: f.infraestructura.trim(),
      certificaciones: lineas(f.certificaciones),
    })

  const guardarHistoricos = (lista: ExperienciaExterna[], aviso: string) => guardar({ experiencia_externa: lista }, aviso)

  async function leerCv(id: string) {
    setLeyendo(true)
    try {
      const r = await fetch("/api/empresa-curriculum/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentoId: id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? `No se pudo leer el currículum (error ${r.status}).`)
      setLectura(d.lectura as LecturaCv)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo leer el currículum.")
    } finally {
      setLeyendo(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar && datos.documentosCv.length > 0 && (
        <Alert>
          <Sparkles />
          <AlertTitle>Ya tienes un currículum en el expediente</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Léelo con IA para llenar la presentación y la experiencia histórica: “{datos.documentosCv[0].nombre}”.
            </span>
            <Button size="sm" className="self-start" onClick={() => leerCv(datos.documentosCv[0].id)} disabled={leyendo}>
              {leyendo ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
              {leyendo ? "Leyendo… (hasta 2 min)" : "Leer con IA"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Experiencia para licitaciones</CardTitle>
          <CardDescription>
            Contratos del sistema más los históricos. Para puntos suelen contar los de los últimos 5 años, concluidos, en años
            distintos y con evidencia de cumplimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador titulo="Concluidos (5 años)" valor={resumen.concluidosRecientes} meta={3} />
            <Indicador titulo="Años distintos" valor={resumen.aniosDistintos} meta={3} />
            <Indicador titulo="Con evidencia de cumplimiento" valor={resumen.conEvidencia} meta={3} />
          </div>
          {resumen.consejos.length > 0 && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              {resumen.consejos.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / contrato</TableHead>
                  <TableHead>Objeto</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Evidencia</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.experiencia.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      Sin experiencia registrada.
                    </TableCell>
                  </TableRow>
                )}
                {datos.experiencia.map((e, i) => {
                  const indiceHist = e.origen === "historico" ? cv.experienciaExterna.findIndex((x) => x.numero === e.numero && x.objeto === e.objeto && x.cliente === e.cliente) : -1
                  return (
                    <TableRow key={`${e.origen}-${e.contratoId ?? i}`}>
                      <TableCell className="min-w-48">
                        <div className="flex flex-col">
                          <span className="font-medium">{e.cliente || "—"}</span>
                          <span className="text-xs text-muted-foreground">
                            {e.numero || "Sin número"} ·{" "}
                            {e.origen === "sistema" ? (
                              <Link href={`/contratos/${e.contratoId}`} className="underline">
                                contrato del sistema
                              </Link>
                            ) : (
                              "histórico"
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-56 text-sm">{e.objeto || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {periodo(e)}
                        {!e.concluido && <Badge variant="info" className="ml-1">vigente</Badge>}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{e.monto != null ? formatoMoneda(e.monto) : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {e.evidencia ? <Badge variant="success">{e.evidencia}</Badge> : <Badge variant="warning">Falta</Badge>}
                      </TableCell>
                      <TableCell>
                        {puedeEditar && indiceHist >= 0 && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setEditando({ indice: indiceHist, valor: cv.experienciaExterna[indiceHist] })}>
                              <Pencil />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Quitar"
                              onClick={() => {
                                if (window.confirm("¿Quitar este contrato histórico del currículum?")) {
                                  void guardarHistoricos(cv.experienciaExterna.filter((_, j) => j !== indiceHist), "Contrato quitado.")
                                }
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {puedeEditar && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setEditando({ indice: null, valor: { cliente: "", numero: "", objeto: "", inicio: "", fin: "", monto: null, evidencia: "" } })
              }
            >
              <Plus data-icon="inline-start" />
              Agregar contrato histórico
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Presentación</CardTitle>
          <CardDescription>Lo que aparece al inicio del currículum impreso.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="cv-sem">Semblanza</FieldLabel>
              <Textarea id="cv-sem" rows={5} value={f.semblanza} disabled={!puedeEditar} onChange={(e) => setF((x) => ({ ...x, semblanza: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="cv-esp">Especialidades</FieldLabel>
                <Textarea id="cv-esp" rows={5} value={f.especialidades} disabled={!puedeEditar} onChange={(e) => setF((x) => ({ ...x, especialidades: e.target.value }))} />
                <FieldDescription>Una por renglón.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="cv-cert">Certificaciones y registros</FieldLabel>
                <Textarea id="cv-cert" rows={5} value={f.certificaciones} disabled={!puedeEditar} onChange={(e) => setF((x) => ({ ...x, certificaciones: e.target.value }))} />
                <FieldDescription>REPSE, ISO, MIPYME, DC-3… una por renglón.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="cv-inf">Infraestructura, herramientas y equipo</FieldLabel>
              <Textarea id="cv-inf" rows={4} value={f.infraestructura} disabled={!puedeEditar} onChange={(e) => setF((x) => ({ ...x, infraestructura: e.target.value }))} />
            </Field>
          </FieldGroup>
          {puedeEditar && (
            <Button className="mt-4" onClick={guardarPresentacion} disabled={guardando}>
              {guardando ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
              Guardar presentación
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal técnico</CardTitle>
          <CardDescription>Se toma de las fichas de técnicos activos de esta empresa.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <span>
            <strong>{datos.personal.total}</strong> técnicos activos, <strong>{datos.personal.conCedula}</strong> con cédula
            profesional.
          </span>
          {datos.personal.puestos.length > 0 && (
            <span className="text-muted-foreground">{datos.personal.puestos.map(([p, n]) => `${n} ${p}`).join(" · ")}</span>
          )}
          {datos.personal.especialidades.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {datos.personal.especialidades.map((e) => (
                <Badge key={e} variant="secondary">
                  {e}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editando && (
        <HistoricoDialog
          valor={editando.valor}
          nuevo={editando.indice === null}
          onClose={() => setEditando(null)}
          onGuardar={async (v) => {
            const lista =
              editando.indice === null
                ? [...cv.experienciaExterna, v]
                : cv.experienciaExterna.map((x, j) => (j === editando.indice ? v : x))
            if (await guardarHistoricos(lista, "Contrato histórico guardado.")) setEditando(null)
          }}
        />
      )}

      {lectura && (
        <AplicarCvDialog
          lectura={lectura}
          actual={cv}
          onClose={() => setLectura(null)}
          onAplicar={async (cambios) => {
            if (await guardar(cambios, "Currículum actualizado con la lectura.")) setLectura(null)
          }}
        />
      )}
    </div>
  )
}

function Indicador({ titulo, valor, meta }: { titulo: string; valor: number; meta: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className={`text-2xl font-semibold tabular-nums ${valor >= meta ? "text-emerald-600" : "text-amber-600"}`}>
        {valor} <span className="text-sm font-normal text-muted-foreground">/ {meta}</span>
      </span>
    </div>
  )
}

function HistoricoDialog({
  valor,
  nuevo,
  onClose,
  onGuardar,
}: {
  valor: ExperienciaExterna
  nuevo: boolean
  onClose: () => void
  onGuardar: (v: ExperienciaExterna) => Promise<void>
}) {
  const [v, setV] = React.useState({ ...valor, monto: valor.monto == null ? "" : String(valor.monto) })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{nuevo ? "Agregar contrato histórico" : "Editar contrato histórico"}</DialogTitle>
          <DialogDescription>Un contrato anterior que no está capturado en Contratos.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="h-cli">Cliente o dependencia</FieldLabel>
            <Input id="h-cli" value={v.cliente} onChange={set("cliente")} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="h-num">Número de contrato</FieldLabel>
              <Input id="h-num" value={v.numero} onChange={set("numero")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="h-monto">Monto con IVA</FieldLabel>
              <Input id="h-monto" inputMode="decimal" value={v.monto} onChange={set("monto")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="h-ini">Inicio</FieldLabel>
              <Input id="h-ini" type="month" value={v.inicio} onChange={set("inicio")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="h-fin">Fin</FieldLabel>
              <Input id="h-fin" type="month" value={v.fin} onChange={set("fin")} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="h-obj">Objeto</FieldLabel>
            <Textarea id="h-obj" value={v.objeto} onChange={set("objeto")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="h-evi">Evidencia de cumplimiento</FieldLabel>
            <Input id="h-evi" value={v.evidencia} onChange={set("evidencia")} placeholder="Acta de aceptación, liberación de fianza…" />
            <FieldDescription>Déjalo vacío si aún no la tienes.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!v.cliente.trim() && !v.objeto.trim()) return toast.error("Captura al menos el cliente o el objeto.")
              const monto = v.monto.replace(/[^0-9.]/g, "")
              void onGuardar({ ...v, cliente: v.cliente.trim(), numero: v.numero.trim(), objeto: v.objeto.trim(), evidencia: v.evidencia.trim(), monto: monto ? Number(monto) : null })
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AplicarCvDialog({
  lectura,
  actual,
  onClose,
  onAplicar,
}: {
  lectura: LecturaCv
  actual: CurriculumEmpresa
  onClose: () => void
  onAplicar: (cambios: Record<string, unknown>) => Promise<void>
}) {
  const clave = (e: ExperienciaExterna) => `${e.numero}|${e.cliente}|${e.objeto}`.toLowerCase()
  const existentes = new Set(actual.experienciaExterna.map(clave))
  const nuevos = lectura.experiencia.filter((e) => !existentes.has(clave(e)))
  const [presentacion, setPresentacion] = React.useState(!actual.semblanza)
  const [experiencia, setExperiencia] = React.useState(true)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lectura del currículum</DialogTitle>
          <DialogDescription>Elige qué usar. Después puedes corregir cualquier dato.</DialogDescription>
        </DialogHeader>
        {lectura.semblanza && <p className="text-sm">{lectura.semblanza}</p>}
        <div className="flex items-center justify-between gap-3 rounded-md border p-2">
          <div className="flex flex-col">
            <Label htmlFor="ap-pres">{actual.semblanza ? "Reemplazar la presentación" : "Usar la presentación"}</Label>
            <span className="text-xs text-muted-foreground">
              Semblanza, {lectura.especialidades.length} especialidad(es), {lectura.certificaciones.length} certificación(es) e infraestructura.
            </span>
          </div>
          <Switch id="ap-pres" checked={presentacion} onCheckedChange={setPresentacion} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border p-2">
          <div className="flex flex-col">
            <Label htmlFor="ap-exp">Agregar contratos históricos</Label>
            <span className="text-xs text-muted-foreground">{nuevos.length} nuevo(s) de {lectura.experiencia.length} leído(s).</span>
          </div>
          <Switch id="ap-exp" checked={experiencia} onCheckedChange={setExperiencia} />
        </div>
        {lectura.advertencias.length > 0 && (
          <Alert>
            <AlertTitle>Revisa</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {lectura.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!presentacion && !(experiencia && nuevos.length)}
            onClick={() =>
              void onAplicar({
                ...(presentacion
                  ? {
                      semblanza: lectura.semblanza,
                      especialidades: lectura.especialidades,
                      infraestructura: lectura.infraestructura,
                      certificaciones: lectura.certificaciones,
                    }
                  : {}),
                ...(experiencia && nuevos.length ? { experiencia_externa: [...actual.experienciaExterna, ...nuevos] } : {}),
              })
            }
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

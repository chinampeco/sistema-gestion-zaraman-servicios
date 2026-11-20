"use client"

import * as React from "react"
import { Download, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  ACCEPT_DOCUMENTOS,
  BUCKET_EXPEDIENTES,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_ARCHIVO_PERMITIDOS,
  formatoTamano,
  nombreArchivoSeguro,
} from "@/lib/contratos"
import { formatFecha, hoyISO } from "@/lib/format"
import { puedeEliminarContratos, puedeGestionarContratos } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import {
  INFO_TIPO_TECNICO,
  TIPOS_DOCUMENTO_TECNICO,
  mapDocumentoTecnico,
  type DocumentoTecnico,
  type TipoDocumentoTecnico,
} from "@/lib/tecnico-documentos"
import { PERFIL_VACIO, perfilVacio, type PerfilTecnico } from "@/lib/tecnico-perfil"
import type { Tecnico } from "@/lib/types"

function sumarDias(fechaISO: string, dias: number): string {
  const d = new Date(`${fechaISO}T00:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

function Vigencia({ hasta }: { hasta: string | null }) {
  if (!hasta) return <Badge variant="secondary">Sin vencimiento</Badge>
  const dias = Math.round((new Date(`${hasta}T00:00:00`).getTime() - new Date(`${hoyISO()}T00:00:00`).getTime()) / 86_400_000)
  if (dias < 0) return <Badge variant="destructive">Vencido</Badge>
  if (dias <= 15) return <Badge variant="outline">Vence en {dias} día(s)</Badge>
  return <Badge>Vigente</Badge>
}

const aLista = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean)

export function ExpedienteTecnico({ tecnico }: { tecnico: Tecnico }) {
  const { usuarioActual, actualizarTecnico } = useStore()
  const puedeGestionar = puedeGestionarContratos(usuarioActual.rol)
  const puedeBorrar = puedeEliminarContratos(usuarioActual.rol)
  const [docs, setDocs] = React.useState<DocumentoTecnico[] | null>(null)
  const [subir, setSubir] = React.useState(false)
  const [borrar, setBorrar] = React.useState<DocumentoTecnico | null>(null)
  const [generando, setGenerando] = React.useState(false)
  const [propuesta, setPropuesta] = React.useState<{
    perfil: PerfilTecnico
    lugarOrigen: string
    regionesTrabajo: string[]
    advertencias: string[]
  } | null>(null)

  const cargar = React.useCallback(async () => {
    const { data } = await createClient()
      .from("tecnico_documentos")
      .select("*")
      .eq("tecnico_id", tecnico.id)
      .order("created_at", { ascending: false })
    setDocs((data ?? []).map(mapDocumentoTecnico))
  }, [tecnico.id])

  React.useEffect(() => {
    void cargar()
  }, [cargar])

  async function ver(d: DocumentoTecnico) {
    const { data, error } = await createClient()
      .storage.from(BUCKET_EXPEDIENTES)
      .createSignedUrl(d.storagePath, 300, { download: d.nombreArchivo })
    if (error || !data) return toast.error("No se pudo abrir el documento.")
    window.open(data.signedUrl, "_blank", "noopener")
  }

  async function confirmarBorrado(): Promise<boolean | void> {
    if (!borrar) return
    const supabase = createClient()
    const { error } = await supabase.from("tecnico_documentos").delete().eq("id", borrar.id)
    if (error) {
      toast.error("No se pudo eliminar.")
      return false
    }
    await supabase.storage.from(BUCKET_EXPEDIENTES).remove([borrar.storagePath])
    setDocs((prev) => (prev ?? []).filter((d) => d.id !== borrar.id))
    setBorrar(null)
    toast.success("Documento eliminado.")
  }

  async function generarPerfil() {
    setGenerando(true)
    const r = await fetch(`/api/tecnicos/${tecnico.id}/perfil`, { method: "POST" })
    const d = await r.json().catch(() => ({ error: "La lectura tardó demasiado." }))
    setGenerando(false)
    if (!r.ok) return toast.error(d.error ?? "No se pudo generar el perfil.")
    setPropuesta({
      perfil: d.perfil,
      lugarOrigen: d.lugarOrigen || tecnico.lugarOrigen || "",
      regionesTrabajo: d.regionesTrabajo?.length ? d.regionesTrabajo : tecnico.regionesTrabajo ?? [],
      advertencias: d.advertencias ?? [],
    })
  }

  async function guardarPerfil() {
    if (!propuesta) return
    await actualizarTecnico(tecnico.id, {
      perfil: propuesta.perfil,
      lugarOrigen: propuesta.lugarOrigen.trim(),
      regionesTrabajo: propuesta.regionesTrabajo.map((r) => r.trim()).filter(Boolean),
      perfilActualizadoAt: new Date().toISOString(),
    })
    setPropuesta(null)
  }

  const perfil = tecnico.perfil ?? PERFIL_VACIO
  const Chips = ({ items }: { items: string[] }) =>
    items.length ? (
      <div className="flex flex-wrap gap-1">{items.map((x) => <Badge key={x} variant="secondary">{x}</Badge>)}</div>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    )

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Perfil del técnico</CardTitle>
            <CardDescription>
              Se usa para sugerir al técnico más apto al asignar órdenes.
              {tecnico.perfilActualizadoAt ? ` Actualizado el ${formatFecha(tecnico.perfilActualizadoAt)}.` : ""}
            </CardDescription>
          </div>
          {puedeGestionar && (
            <Button variant="outline" onClick={generarPerfil} disabled={generando}>
              {generando ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
              {perfilVacio(perfil) ? "Generar perfil con IA" : "Actualizar perfil con IA"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {perfilVacio(perfil) && !tecnico.lugarOrigen ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Aún no tiene perfil. Sube su currículum y certificaciones abajo y da clic en “Generar perfil con IA”.
            </p>
          ) : (
            <>
              {perfil.resumen && <p className="text-sm sm:col-span-2">{perfil.resumen}</p>}
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Especialidades</span><Chips items={perfil.especialidades} /></div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Equipos</span><Chips items={perfil.equipos} /></div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Marcas</span><Chips items={perfil.marcas} /></div>
              <div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Certificaciones</span><Chips items={perfil.certificaciones} /></div>
              <div className="text-sm"><span className="text-muted-foreground">Estudios: </span>{perfil.estudios || "—"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Experiencia: </span>{perfil.aniosExperiencia != null ? `${perfil.aniosExperiencia} años` : "—"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Lugar de origen: </span>{tecnico.lugarOrigen || "—"}</div>
              <div className="text-sm"><span className="text-muted-foreground">Regiones de trabajo: </span>{(tecnico.regionesTrabajo ?? []).join(", ") || "—"}</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Expediente</CardTitle>
            <CardDescription>Currículum, cédula, DC-3, INE, alta IMSS, examen médico y demás documentos, con su vigencia.</CardDescription>
          </div>
          {puedeGestionar && (
            <Button onClick={() => setSubir(true)}>
              <Upload data-icon="inline-start" />
              Subir documento
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {docs === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin documentos.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{d.tipo}{d.descripcion ? ` · ${d.descripcion}` : ""}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {d.nombreArchivo} · {formatoTamano(d.tamanoBytes)}
                      {d.fechaEmision ? ` · emitido ${formatFecha(d.fechaEmision)}` : ""}
                      {d.vigenteHasta ? ` · vigente hasta ${formatFecha(d.vigenteHasta)}` : ""}
                    </div>
                  </div>
                  <Vigencia hasta={d.vigenteHasta} />
                  {usuarioActual.rol !== "Técnico" && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Descargar ${d.nombreArchivo}`} onClick={() => ver(d)}>
                      <Download />
                    </Button>
                  )}
                  {puedeBorrar && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${d.nombreArchivo}`} onClick={() => setBorrar(d)}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SubirDocumentoTecnico
        abierto={subir}
        tecnico={tecnico}
        onCerrar={() => setSubir(false)}
        onSubido={(d) => setDocs((prev) => [d, ...(prev ?? [])])}
      />

      <ConfirmDeleteDialog
        open={borrar !== null}
        onOpenChange={(o) => !o && setBorrar(null)}
        title="Eliminar documento"
        description={`Se eliminará “${borrar?.nombreArchivo ?? ""}” del expediente del técnico.`}
        onConfirm={confirmarBorrado}
      />

      <Dialog open={propuesta !== null} onOpenChange={(o) => !o && setPropuesta(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Revisa el perfil propuesto</DialogTitle>
            <DialogDescription>Lo armó la IA con el expediente. Corrige lo necesario; separa con comas.</DialogDescription>
          </DialogHeader>
          {propuesta && (
            <FieldGroup className="min-h-0 flex-1 overflow-y-auto py-4">
              {propuesta.advertencias.length > 0 && (
                <Alert>
                  <AlertTitle>Revisa</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5">{propuesta.advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}
              {(
                [
                  ["especialidades", "Especialidades"],
                  ["equipos", "Equipos que ha atendido"],
                  ["marcas", "Marcas"],
                  ["certificaciones", "Certificaciones"],
                ] as const
              ).map(([k, etiqueta]) => (
                <Field key={k}>
                  <FieldLabel htmlFor={`pf-${k}`}>{etiqueta}</FieldLabel>
                  <Input
                    id={`pf-${k}`}
                    defaultValue={propuesta.perfil[k].join(", ")}
                    onChange={(e) => setPropuesta({ ...propuesta, perfil: { ...propuesta.perfil, [k]: aLista(e.target.value) } })}
                  />
                </Field>
              ))}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="pf-estudios">Estudios</FieldLabel>
                  <Input id="pf-estudios" value={propuesta.perfil.estudios} onChange={(e) => setPropuesta({ ...propuesta, perfil: { ...propuesta.perfil, estudios: e.target.value } })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-anios">Años de experiencia</FieldLabel>
                  <Input
                    id="pf-anios"
                    type="number"
                    min={0}
                    value={propuesta.perfil.aniosExperiencia ?? ""}
                    onChange={(e) => setPropuesta({ ...propuesta, perfil: { ...propuesta.perfil, aniosExperiencia: e.target.value === "" ? null : Number(e.target.value) } })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-origen">Lugar de origen</FieldLabel>
                  <Input id="pf-origen" value={propuesta.lugarOrigen} onChange={(e) => setPropuesta({ ...propuesta, lugarOrigen: e.target.value })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pf-regiones">Regiones de trabajo</FieldLabel>
                  <Input id="pf-regiones" defaultValue={propuesta.regionesTrabajo.join(", ")} onChange={(e) => setPropuesta({ ...propuesta, regionesTrabajo: aLista(e.target.value) })} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="pf-resumen">Resumen para quien asigna</FieldLabel>
                <Textarea id="pf-resumen" rows={3} value={propuesta.perfil.resumen} onChange={(e) => setPropuesta({ ...propuesta, perfil: { ...propuesta.perfil, resumen: e.target.value } })} />
              </Field>
            </FieldGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropuesta(null)}>Cancelar</Button>
            <Button onClick={guardarPerfil}>Guardar perfil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function SubirDocumentoTecnico({
  abierto,
  tecnico,
  onCerrar,
  onSubido,
}: {
  abierto: boolean
  tecnico: Tecnico
  onCerrar: () => void
  onSubido: (d: DocumentoTecnico) => void
}) {
  const { empresaActiva } = useStore()
  const [tipo, setTipo] = React.useState<TipoDocumentoTecnico>("Currículum")
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const [emision, setEmision] = React.useState("")
  const [vigencia, setVigencia] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [subiendo, setSubiendo] = React.useState(false)

  React.useEffect(() => {
    if (!abierto) return
    setTipo("Currículum")
    setArchivo(null)
    setEmision("")
    setVigencia("")
    setDescripcion("")
  }, [abierto])

  const cambiarTipo = (t: TipoDocumentoTecnico) => {
    setTipo(t)
    const dias = INFO_TIPO_TECNICO[t].vigenciaDias
    if (dias && emision) setVigencia(sumarDias(emision, dias))
  }
  const cambiarEmision = (f: string) => {
    setEmision(f)
    const dias = INFO_TIPO_TECNICO[tipo].vigenciaDias
    if (dias && f) setVigencia(sumarDias(f, dias))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!empresaActiva) return toast.error("Selecciona una empresa.")
    if (!archivo) return toast.error("Elige el archivo.")
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) return toast.error("El archivo pesa más de 25 MB.")
    if (archivo.type && !TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type))
      return toast.error("Formato no permitido. Usa PDF, Word, Excel o imagen.")
    if (emision && vigencia && vigencia < emision) return toast.error("La vigencia termina antes de la emisión.")
    setSubiendo(true)
    const supabase = createClient()
    const ruta = `${empresaActiva.id}/tecnicos/${tecnico.id}/${Date.now()}-${nombreArchivoSeguro(archivo.name)}`
    const { error: errorArchivo } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })
    if (errorArchivo) {
      setSubiendo(false)
      return toast.error("No se pudo subir el archivo.")
    }
    const { data, error } = await supabase
      .from("tecnico_documentos")
      .insert({
        tecnico_id: tecnico.id,
        tipo,
        descripcion: descripcion.trim(),
        nombre_archivo: archivo.name,
        storage_path: ruta,
        mime_type: archivo.type,
        tamano_bytes: archivo.size,
        fecha_emision: emision || null,
        vigente_hasta: vigencia || null,
      })
      .select("*")
      .single()
    setSubiendo(false)
    if (error || !data) return toast.error("El archivo subió, pero no se pudo registrar.")
    toast.success("Documento guardado.")
    onSubido(mapDocumentoTecnico(data))
    onCerrar()
  }

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>Subir documento de {tecnico.nombre}</DialogTitle>
            <DialogDescription>Se guarda en el expediente privado del técnico.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>Documento</FieldLabel>
              <Select value={tipo} onValueChange={(v) => cambiarTipo(v as TipoDocumentoTecnico)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO_TECNICO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldDescription>{INFO_TIPO_TECNICO[tipo].ayuda}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="dt-archivo">Archivo</FieldLabel>
              <Input id="dt-archivo" type="file" accept={ACCEPT_DOCUMENTOS} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="dt-emision">Fecha de emisión</FieldLabel>
                <Input id="dt-emision" type="date" value={emision} onChange={(e) => cambiarEmision(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="dt-vigencia">Vigente hasta</FieldLabel>
                <Input id="dt-vigencia" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                <FieldDescription>Déjalo vacío si no vence.</FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="dt-desc">Descripción (opcional)</FieldLabel>
              <Input id="dt-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. DC-3 trabajos en altura" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>Cancelar</Button>
            <Button type="submit" disabled={subiendo}>
              {subiendo && <Spinner data-icon="inline-start" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

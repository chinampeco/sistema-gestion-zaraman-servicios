"use client"

import * as React from "react"
import { CalendarCheck, Download, History, Info, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import { formatFecha, hoyISO } from "@/lib/format"
import { puedeEliminarContratos, puedeGestionarContratos } from "@/lib/permisos"
import {
  ACCEPT_DOCUMENTOS,
  BUCKET_EXPEDIENTES,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_ARCHIVO_PERMITIDOS,
  formatoTamano,
  nombreArchivoSeguro,
} from "@/lib/contratos"
import {
  DIAS_AVISO,
  GRUPOS,
  INFO_TIPO,
  TIPOS_DOCUMENTO_EMPRESA,
  estadoDocumento,
  mapDocumentoEmpresa,
  sumarDias,
  vigentePorTipo,
  type DocumentoEmpresa,
  type EstadoVigencia,
  type TipoDocumentoEmpresa,
} from "@/lib/empresa-documentos"

const ESTILO: Record<EstadoVigencia, "default" | "secondary" | "outline" | "destructive"> = {
  Vigente: "default",
  "Sin vencimiento": "secondary",
  "Por vencer": "outline",
  Vencido: "destructive",
  Faltante: "destructive",
}

export default function DocumentosEmpresaPage() {
  const { empresaActiva, usuarioActual } = useStore()
  const [docs, setDocs] = React.useState<DocumentoEmpresa[] | null>(null)
  const [fechaRef, setFechaRef] = React.useState(hoyISO())
  const [subir, setSubir] = React.useState<{ abierto: boolean; tipo: TipoDocumentoEmpresa }>({ abierto: false, tipo: "Opinión de cumplimiento SAT (32-D)" })
  const [historial, setHistorial] = React.useState<TipoDocumentoEmpresa | null>(null)
  const [eliminando, setEliminando] = React.useState<DocumentoEmpresa | null>(null)
  const puedeSubir = puedeGestionarContratos(usuarioActual.rol)
  const puedeEliminar = puedeEliminarContratos(usuarioActual.rol)

  React.useEffect(() => {
    let vigente = true
    createClient()
      .from("empresa_documentos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!vigente) return
        if (error) toast.error("No se pudieron cargar los documentos.")
        setDocs((data ?? []).map(mapDocumentoEmpresa))
      })
    return () => {
      vigente = false
    }
  }, [empresaActiva?.id])

  const actuales = React.useMemo(() => vigentePorTipo(docs ?? []), [docs])
  const esHoy = fechaRef === hoyISO()

  // Resumen de los documentos básicos (los que piden casi todas las licitaciones).
  const basicos = TIPOS_DOCUMENTO_EMPRESA.filter((t) => INFO_TIPO[t].basico)
  const conteo = { ok: 0, porVencer: 0, mal: 0 }
  for (const t of basicos) {
    const e = estadoDocumento(actuales.get(t), fechaRef)
    if (e === "Vigente" || e === "Sin vencimiento") conteo.ok++
    else if (e === "Por vencer") conteo.porVencer++
    else conteo.mal++
  }

  async function abrir(doc: DocumentoEmpresa) {
    const { data } = await createClient()
      .storage.from(BUCKET_EXPEDIENTES)
      .createSignedUrl(doc.storagePath, 120, { download: doc.nombreArchivo })
    if (data) window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    else toast.error("No se pudo abrir el documento.")
  }

  async function eliminar(doc: DocumentoEmpresa): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from("empresa_documentos").delete().eq("id", doc.id)
    if (error) {
      toast.error("No se pudo eliminar.")
      return false
    }
    await supabase.storage.from(BUCKET_EXPEDIENTES).remove([doc.storagePath])
    setDocs((prev) => (prev ?? []).filter((d) => d.id !== doc.id))
    toast.success("Documento eliminado.")
    return true
  }

  return (
    <>
      <PageHeader
        title="Documentos de la empresa"
        description={`Expediente legal y fiscal de ${empresaActiva?.nombreComercial ?? "la empresa"} para ComprasMX y licitaciones, con sus vigencias.`}
        actions={
          puedeSubir ? (
            <Button onClick={() => setSubir({ abierto: true, tipo: "Opinión de cumplimiento SAT (32-D)" })}>
              <Upload data-icon="inline-start" />
              Subir documento
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="size-5" />
            Validar para una licitación
          </CardTitle>
          <CardDescription>
            Pon la fecha de presentación de propuestas (o de firma del contrato) y revisa qué estará vigente ese día.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field className="sm:w-56">
              <FieldLabel htmlFor="fecha-ref">Fecha a validar</FieldLabel>
              <Input id="fecha-ref" type="date" value={fechaRef} onChange={(e) => setFechaRef(e.target.value || hoyISO())} />
            </Field>
            {!esHoy && (
              <Button variant="ghost" onClick={() => setFechaRef(hoyISO())}>Volver a hoy</Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Resumen valor={conteo.ok} etiqueta="Listos" clase="text-primary" />
            <Resumen valor={conteo.porVencer} etiqueta={`Vencen en ≤ ${DIAS_AVISO} días`} clase="text-amber-600" />
            <Resumen valor={conteo.mal} etiqueta="Vencidos o faltantes" clase="text-destructive" />
          </div>
          <p className="text-xs text-muted-foreground">
            Cuenta solo los {basicos.length} documentos básicos que piden casi todas las convocatorias. Las vigencias
            sugeridas son las usuales; revisa siempre lo que pide cada convocatoria.
          </p>
        </CardContent>
      </Card>

      {docs === null ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        GRUPOS.map((grupo) => (
          <Card key={grupo}>
            <CardHeader><CardTitle>{grupo}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ul className="flex flex-col divide-y">
                {TIPOS_DOCUMENTO_EMPRESA.filter((t) => INFO_TIPO[t].grupo === grupo).map((tipo) => {
                  const doc = actuales.get(tipo)
                  const estado = estadoDocumento(doc, fechaRef)
                  const versiones = (docs ?? []).filter((d) => d.tipo === tipo).length
                  if (!doc && !INFO_TIPO[tipo].basico && tipo === "Otro") return null
                  return (
                    <li key={tipo} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{tipo}</span>
                          {INFO_TIPO[tipo].basico && <Badge variant="outline" className="font-normal">Básico</Badge>}
                          <Badge variant={ESTILO[estado]}>{estado}</Badge>
                        </div>
                        {doc ? (
                          <span className="text-xs text-muted-foreground">
                            {doc.nombreArchivo} · {formatoTamano(doc.tamanoBytes)}
                            {doc.fechaEmision ? ` · emitido ${formatFecha(doc.fechaEmision)}` : ""}
                            {doc.vigenteHasta ? ` · vigente hasta ${formatFecha(doc.vigenteHasta)}` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{INFO_TIPO[tipo].ayuda}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 self-end sm:self-auto">
                        {doc && (
                          <Button variant="outline" size="sm" onClick={() => abrir(doc)}>
                            <Download data-icon="inline-start" />
                            Ver
                          </Button>
                        )}
                        {versiones > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setHistorial(tipo)}>
                            <History data-icon="inline-start" />
                            {versiones}
                          </Button>
                        )}
                        {puedeSubir && (
                          <Button variant={doc ? "ghost" : "default"} size="sm" onClick={() => setSubir({ abierto: true, tipo })}>
                            <Upload data-icon="inline-start" />
                            {doc ? "Actualizar" : "Subir"}
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <SubirDocumentoEmpresa
        abierto={subir.abierto}
        tipoInicial={subir.tipo}
        empresaId={empresaActiva?.id ?? ""}
        onCerrar={() => setSubir((s) => ({ ...s, abierto: false }))}
        onSubido={(d) => setDocs((prev) => [d, ...(prev ?? [])])}
      />

      <Dialog open={historial !== null} onOpenChange={(o) => !o && setHistorial(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{historial}</DialogTitle>
            <DialogDescription>Todas las versiones subidas (la vigente aparece primero en la lista principal).</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y rounded-lg border">
            {(docs ?? []).filter((d) => d.tipo === historial).map((d) => (
              <li key={d.id} className="flex items-center gap-2 p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {d.nombreArchivo}
                  <span className="block text-xs text-muted-foreground">
                    {d.vigenteHasta ? `Vigente hasta ${formatFecha(d.vigenteHasta)}` : "Sin vencimiento"} · subido {formatFecha(d.createdAt.slice(0, 10))}
                  </span>
                </span>
                <Button variant="ghost" size="icon-sm" aria-label="Descargar" onClick={() => abrir(d)}><Download /></Button>
                {puedeEliminar && (
                  <Button variant="ghost" size="icon-sm" aria-label="Eliminar" className="text-muted-foreground hover:text-destructive" onClick={() => setEliminando(d)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={eliminando !== null}
        onOpenChange={(o) => !o && setEliminando(null)}
        title="¿Eliminar documento?"
        description={<>Se eliminará <strong>{eliminando?.nombreArchivo}</strong>. No se puede deshacer.</>}
        onConfirm={async () => (eliminando ? eliminar(eliminando) : false)}
      />
    </>
  )
}

function Resumen({ valor, etiqueta, clase }: { valor: number; etiqueta: string; clase: string }) {
  return (
    <div className="flex flex-col rounded-lg border p-2">
      <span className={`text-2xl font-semibold tabular-nums ${clase}`}>{valor}</span>
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
    </div>
  )
}

function SubirDocumentoEmpresa({
  abierto,
  tipoInicial,
  empresaId,
  onCerrar,
  onSubido,
}: {
  abierto: boolean
  tipoInicial: TipoDocumentoEmpresa
  empresaId: string
  onCerrar: () => void
  onSubido: (d: DocumentoEmpresa) => void
}) {
  const [tipo, setTipo] = React.useState<TipoDocumentoEmpresa>(tipoInicial)
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const [emision, setEmision] = React.useState("")
  const [vigencia, setVigencia] = React.useState("")
  const [descripcion, setDescripcion] = React.useState("")
  const [notas, setNotas] = React.useState("")
  const [subiendo, setSubiendo] = React.useState(false)

  React.useEffect(() => {
    if (!abierto) return
    setTipo(tipoInicial)
    setArchivo(null)
    setEmision(hoyISO())
    const dias = INFO_TIPO[tipoInicial].vigenciaDias
    setVigencia(dias ? sumarDias(hoyISO(), dias) : "")
    setDescripcion("")
    setNotas("")
  }, [abierto, tipoInicial])

  const cambiarTipo = (t: TipoDocumentoEmpresa) => {
    setTipo(t)
    const dias = INFO_TIPO[t].vigenciaDias
    setVigencia(dias && emision ? sumarDias(emision, dias) : "")
  }
  const cambiarEmision = (f: string) => {
    setEmision(f)
    const dias = INFO_TIPO[tipo].vigenciaDias
    if (dias && f) setVigencia(sumarDias(f, dias))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!empresaId) return toast.error("Selecciona una empresa.")
    if (!archivo) return toast.error("Elige el archivo.")
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) return toast.error("El archivo pesa más de 25 MB.")
    if (archivo.type && !TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type))
      return toast.error("Formato no permitido. Usa PDF, Word, Excel, XML o imagen.")
    if (emision && vigencia && vigencia < emision) return toast.error("La vigencia termina antes de la emisión.")

    setSubiendo(true)
    const supabase = createClient()
    const ruta = `${empresaId}/empresa/${Date.now()}-${nombreArchivoSeguro(archivo.name)}`
    const { error: errorArchivo } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })
    if (errorArchivo) {
      setSubiendo(false)
      return toast.error("No se pudo subir el archivo.")
    }
    const { data, error } = await supabase
      .from("empresa_documentos")
      .insert({
        tipo,
        descripcion: descripcion.trim(),
        nombre_archivo: archivo.name,
        storage_path: ruta,
        mime_type: archivo.type,
        tamano_bytes: archivo.size,
        fecha_emision: emision || null,
        vigente_hasta: vigencia || null,
        notas: notas.trim(),
      })
      .select("*")
      .single()
    setSubiendo(false)
    if (error || !data) {
      await supabase.storage.from(BUCKET_EXPEDIENTES).remove([ruta])
      return toast.error("El archivo subió, pero no se pudo registrar.")
    }
    toast.success("Documento guardado.")
    onSubido(mapDocumentoEmpresa(data))
    onCerrar()
  }

  const info = INFO_TIPO[tipo]

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={guardar}>
          <DialogHeader>
            <DialogTitle>Subir documento de la empresa</DialogTitle>
            <DialogDescription>Se guarda en el expediente privado de la empresa activa.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>Documento</FieldLabel>
              <Select value={tipo} onValueChange={(v) => cambiarTipo(v as TipoDocumentoEmpresa)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO_EMPRESA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Alert>
              <Info />
              <AlertTitle>Dónde se obtiene</AlertTitle>
              <AlertDescription>{info.ayuda}</AlertDescription>
            </Alert>
            <Field>
              <FieldLabel htmlFor="de-archivo">Archivo</FieldLabel>
              <Input id="de-archivo" type="file" accept={ACCEPT_DOCUMENTOS} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <FieldDescription>PDF, imagen, Word o Excel. Máximo 25 MB.</FieldDescription>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="de-emision">Fecha de emisión</FieldLabel>
                <Input id="de-emision" type="date" value={emision} onChange={(e) => cambiarEmision(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="de-vigencia">Vigente hasta</FieldLabel>
                <Input id="de-vigencia" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                <FieldDescription>
                  {info.vigenciaDias ? `Sugerido: ${info.vigenciaDias} días desde la emisión.` : "Déjalo vacío si no vence."}
                </FieldDescription>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="de-desc">Descripción (opcional)</FieldLabel>
              <Input id="de-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Escritura 8,742, Notaría 158" />
            </Field>
            <Field>
              <FieldLabel htmlFor="de-notas">Notas (opcional)</FieldLabel>
              <Textarea id="de-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
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

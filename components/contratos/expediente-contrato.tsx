"use client"

import * as React from "react"
import { Download, FileText, FolderOpen, Trash2, Upload } from "lucide-react"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { createClient } from "@/lib/supabase/client"
import { formatFecha } from "@/lib/format"
import {
  ACCEPT_DOCUMENTOS,
  BUCKET_EXPEDIENTES,
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_ARCHIVO_PERMITIDOS,
  TIPOS_DOCUMENTO,
  diasPara,
  formatoTamano,
  mapDocumento,
  nombreArchivoSeguro,
  type ContratoDocumento,
  type TipoDocumento,
} from "@/lib/contratos"

export function ExpedienteContrato({
  contratoId,
  empresaId,
  documentos,
  onCambio,
  puedeSubir,
  puedeEliminar,
}: {
  contratoId: string
  empresaId: string
  documentos: ContratoDocumento[]
  onCambio: (docs: ContratoDocumento[]) => void
  puedeSubir: boolean
  puedeEliminar: boolean
}) {
  const [subirAbierto, setSubirAbierto] = React.useState(false)
  const [eliminando, setEliminando] = React.useState<ContratoDocumento | null>(null)
  const [abriendo, setAbriendo] = React.useState<string | null>(null)

  async function abrir(doc: ContratoDocumento) {
    setAbriendo(doc.id)
    const supabase = createClient()
    // URL firmada de corta duración: el bucket es privado.
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .createSignedUrl(doc.storagePath, 120, { download: doc.nombreArchivo })
    setAbriendo(null)
    if (error || !data) {
      toast.error("No se pudo abrir el documento.")
      return
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }

  async function eliminar(doc: ContratoDocumento): Promise<boolean> {
    const supabase = createClient()
    const { error } = await supabase.from("contrato_documentos").delete().eq("id", doc.id)
    if (error) {
      toast.error("No se pudo eliminar el documento.")
      return false
    }
    const { error: errorArchivo } = await supabase.storage.from(BUCKET_EXPEDIENTES).remove([doc.storagePath])
    if (errorArchivo) toast.warning("Se quitó del expediente, pero el archivo no se pudo borrar del almacenamiento.")
    else toast.success("Documento eliminado.")
    onCambio(documentos.filter((d) => d.id !== doc.id))
    return true
  }

  const ordenados = [...documentos].sort(
    (a, b) => TIPOS_DOCUMENTO.indexOf(a.tipo) - TIPOS_DOCUMENTO.indexOf(b.tipo) || b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <div className="flex flex-col gap-3">
      {puedeSubir && (
        <div className="flex justify-end">
          <Button onClick={() => setSubirAbierto(true)}>
            <Upload data-icon="inline-start" />
            Subir documento
          </Button>
        </div>
      )}

      {ordenados.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderOpen /></EmptyMedia>
            <EmptyTitle>Expediente vacío</EmptyTitle>
            <EmptyDescription>
              Sube el contrato, anexos, fianzas, actas, CFDI y opiniones de cumplimiento.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {ordenados.map((d) => {
            const dias = diasPara(d.vigenteHasta)
            return (
              <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <FileText className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{d.tipo}</Badge>
                    {dias !== null && (
                      <Badge variant={dias < 0 ? "destructive" : dias <= 30 ? "outline" : "secondary"}>
                        {dias < 0 ? `Venció hace ${-dias} días` : `Vigente hasta ${formatFecha(d.vigenteHasta)}`}
                      </Badge>
                    )}
                  </div>
                  <span className="truncate text-sm font-medium" title={d.nombreArchivo}>{d.nombreArchivo}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatoTamano(d.tamanoBytes)}
                    {d.fechaDocumento ? ` · Fecha del documento: ${formatFecha(d.fechaDocumento)}` : ""}
                    {d.notas ? ` · ${d.notas}` : ""}
                  </span>
                </div>
                <div className="flex gap-1 self-end sm:self-auto">
                  <Button variant="outline" size="sm" onClick={() => abrir(d)} disabled={abriendo === d.id}>
                    {abriendo === d.id ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                    Descargar
                  </Button>
                  {puedeEliminar && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${d.nombreArchivo}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setEliminando(d)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <SubirDocumentoDialog
        open={subirAbierto}
        onOpenChange={setSubirAbierto}
        contratoId={contratoId}
        empresaId={empresaId}
        onSubido={(doc) => onCambio([doc, ...documentos])}
      />

      <ConfirmDeleteDialog
        open={eliminando !== null}
        onOpenChange={(o) => !o && setEliminando(null)}
        title="¿Eliminar documento del expediente?"
        description={<>Se eliminará <strong>{eliminando?.nombreArchivo}</strong>. Esta acción no se puede deshacer.</>}
        onConfirm={async () => (eliminando ? eliminar(eliminando) : false)}
      />
    </div>
  )
}

function SubirDocumentoDialog({
  open,
  onOpenChange,
  contratoId,
  empresaId,
  onSubido,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contratoId: string
  empresaId: string
  onSubido: (doc: ContratoDocumento) => void
}) {
  const [tipo, setTipo] = React.useState<TipoDocumento>("Contrato")
  const [archivo, setArchivo] = React.useState<File | null>(null)
  const [fechaDocumento, setFechaDocumento] = React.useState("")
  const [vigenteHasta, setVigenteHasta] = React.useState("")
  const [notas, setNotas] = React.useState("")
  const [subiendo, setSubiendo] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setTipo("Contrato")
      setArchivo(null)
      setFechaDocumento("")
      setVigenteHasta("")
      setNotas("")
    }
  }, [open])

  async function subir(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) return toast.error("Elige el archivo.")
    if (archivo.size > TAMANO_MAXIMO_DOCUMENTO) return toast.error("El archivo pesa más de 25 MB.")
    if (archivo.type && !TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type))
      return toast.error("Formato no permitido. Usa PDF, Word, Excel, XML o imagen.")

    setSubiendo(true)
    const supabase = createClient()
    const ruta = `${empresaId}/${contratoId}/${Date.now()}-${nombreArchivoSeguro(archivo.name)}`
    const { error: errorArchivo } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false })
    if (errorArchivo) {
      setSubiendo(false)
      toast.error("No se pudo subir el archivo.")
      return
    }
    const { data, error } = await supabase
      .from("contrato_documentos")
      .insert({
        contrato_id: contratoId,
        tipo,
        nombre_archivo: archivo.name,
        storage_path: ruta,
        mime_type: archivo.type,
        tamano_bytes: archivo.size,
        fecha_documento: fechaDocumento || null,
        vigente_hasta: vigenteHasta || null,
        notas: notas.trim(),
      })
      .select("*")
      .single()
    setSubiendo(false)
    if (error || !data) {
      // Se intenta quitar el archivo huérfano (solo lo logra el Administrador).
      await supabase.storage.from(BUCKET_EXPEDIENTES).remove([ruta])
      toast.error("El archivo subió, pero no se pudo registrar en el expediente.")
      return
    }
    toast.success("Documento agregado al expediente.")
    onSubido(mapDocumento(data))
    onOpenChange(false)
  }

  const llevaVigencia = tipo === "Garantía de cumplimiento" || tipo === "Garantía de calidad" || tipo === "Opinión de cumplimiento"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={subir}>
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
            <DialogDescription>Se guarda en el expediente privado de este contrato.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Field>
              <FieldLabel>Tipo de documento</FieldLabel>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="doc-archivo">Archivo</FieldLabel>
              <Input id="doc-archivo" type="file" accept={ACCEPT_DOCUMENTOS} onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
              <FieldDescription>PDF, Word, Excel, XML (CFDI) o imagen. Máximo 25 MB.</FieldDescription>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="doc-fecha">Fecha del documento</FieldLabel>
                <Input id="doc-fecha" type="date" value={fechaDocumento} onChange={(e) => setFechaDocumento(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="doc-vigencia">Vigente hasta {llevaVigencia ? "" : "(opcional)"}</FieldLabel>
                <Input id="doc-vigencia" type="date" value={vigenteHasta} onChange={(e) => setVigenteHasta(e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="doc-notas">Notas</FieldLabel>
              <Textarea id="doc-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Póliza 26A53626, Dorama" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={subiendo}>
              {subiendo && <Spinner data-icon="inline-start" />}
              Subir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

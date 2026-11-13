"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileText, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { RevisionImportacion, type SeleccionCliente } from "@/components/contratos/importacion/revision-importacion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import { puedeGestionarContratos } from "@/lib/permisos"
import { BUCKET_EXPEDIENTES, formatoTamano } from "@/lib/contratos"
import {
  ACCEPT_IMPORTACION,
  MAX_ARCHIVOS_IMPORTACION,
  MAX_BYTES_IMPORTACION,
  MAX_BYTES_TOTAL_IMPORTACION,
  TIPOS_LECTURA,
  type ExtraccionContrato,
} from "@/lib/importacion-contratos"
import { guardarImportacion, type ArchivoLote } from "@/lib/importacion-guardar"

type Paso = "subir" | "analizando" | "revision" | "guardando" | "listo"

const normalizar = (s: string) =>
  s.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "")

export default function ImportarContratoPage() {
  const { clientes, equipos, ordenes, usuarioActual, empresaActiva } = useStore()
  const [paso, setPaso] = React.useState<Paso>("subir")
  const [archivos, setArchivos] = React.useState<File[]>([])
  const [lote, setLote] = React.useState<{ id: string; archivos: ArchivoLote[] } | null>(null)
  const [extraccion, setExtraccion] = React.useState<ExtraccionContrato | null>(null)
  const [cliente, setCliente] = React.useState<SeleccionCliente>({ clienteId: null, nuevo: { nombre: "", rfc: "", direccion: "" } })
  const [crearEquipos, setCrearEquipos] = React.useState(true)
  const [crearOrdenes, setCrearOrdenes] = React.useState(true)
  const [mensaje, setMensaje] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [resultado, setResultado] = React.useState<{ contratoId: string | null; pasos: string[] } | null>(null)

  const sugerencias = React.useMemo(() => [...equipos, ...ordenes], [equipos, ordenes])
  const totalBytes = archivos.reduce((s, f) => s + f.size, 0)

  if (!puedeGestionarContratos(usuarioActual.rol)) {
    return (
      <Alert>
        <AlertTitle>Sin permiso</AlertTitle>
        <AlertDescription>Solo Administrador, Coordinador o Supervisor pueden registrar contratos.</AlertDescription>
      </Alert>
    )
  }

  function agregar(lista: FileList | null) {
    if (!lista) return
    const nuevos: File[] = []
    for (const f of Array.from(lista)) {
      if (!(f.type in TIPOS_LECTURA)) {
        toast.error(`“${f.name}”: usa PDF, Word (.docx) o imagen.`)
        continue
      }
      if (f.size > MAX_BYTES_IMPORTACION) {
        toast.error(`“${f.name}” pesa más de ${MAX_BYTES_IMPORTACION / 1024 / 1024} MB.`)
        continue
      }
      nuevos.push(f)
    }
    setArchivos((prev) => [...prev, ...nuevos].slice(0, MAX_ARCHIVOS_IMPORTACION))
  }

  async function limpiarLote(id: string) {
    await fetch("/api/contratos/importacion/limpiar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote: id }),
    }).catch(() => undefined)
  }

  async function analizar() {
    setError(null)
    if (archivos.length === 0) return setError("Agrega el contrato y su ficha o anexo técnico.")
    if (totalBytes > MAX_BYTES_TOTAL_IMPORTACION)
      return setError(`Los archivos suman más de ${MAX_BYTES_TOTAL_IMPORTACION / 1024 / 1024} MB.`)

    setPaso("analizando")
    setMensaje("Subiendo archivos…")
    const supabase = createClient()
    try {
      // 1. Rutas firmadas y subida directa al almacenamiento.
      const r1 = await fetch("/api/contratos/importacion/subida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivos: archivos.map((f) => ({ nombre: f.name, tipo: f.type, tamano: f.size })) }),
      })
      const d1 = await r1.json()
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo preparar la subida.")
      const subidas: { indice: number; ruta: string; token: string }[] = d1.subidas
      for (const s of subidas) {
        const f = archivos[s.indice]
        const { error: e } = await supabase.storage.from(BUCKET_EXPEDIENTES).uploadToSignedUrl(s.ruta, s.token, f, { contentType: f.type })
        if (e) throw new Error(`No se pudo subir “${f.name}”.`)
      }
      const archivosLote: ArchivoLote[] = subidas.map((s) => ({
        indice: s.indice,
        nombre: archivos[s.indice].name,
        tipo: archivos[s.indice].type,
        tamano: archivos[s.indice].size,
        ruta: s.ruta,
      }))
      setLote({ id: d1.lote, archivos: archivosLote })

      // 2. Lectura con IA.
      setMensaje("Leyendo los documentos con IA… (un contrato escaneado puede tardar 1 a 3 minutos)")
      const r2 = await fetch("/api/contratos/importacion/analizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lote: d1.lote, nombres: archivos.map((f) => f.name) }),
      })
      const d2 = await r2.json().catch(() => ({ error: "El análisis tardó demasiado o se interrumpió." }))
      if (!r2.ok) {
        await limpiarLote(d1.lote)
        throw new Error(d2.error ?? "No se pudo analizar.")
      }
      const ex: ExtraccionContrato = d2.extraccion
      setExtraccion(ex)

      // Si la dependencia ya existe (mismo RFC o nombre), se propone esa.
      const existente =
        clientes.find((c) => ex.dependencia.rfc && c.rfc.toUpperCase() === ex.dependencia.rfc) ??
        clientes.find((c) => ex.dependencia.nombre && normalizar(c.nombre) === normalizar(ex.dependencia.nombre))
      setCliente({
        clienteId: existente?.id ?? null,
        nuevo: { nombre: ex.dependencia.nombre, rfc: ex.dependencia.rfc, direccion: ex.dependencia.domicilio },
      })
      setPaso("revision")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.")
      setPaso("subir")
    }
  }

  async function confirmar() {
    if (!extraccion || !lote || !empresaActiva) return
    setError(null)
    if (!extraccion.contrato.numero_contrato.trim()) return setError("Captura el número de contrato.")
    if (!cliente.clienteId && !cliente.nuevo.nombre.trim()) return setError("Indica la dependencia.")

    setPaso("guardando")
    const r = await guardarImportacion(
      createClient(),
      extraccion,
      lote.archivos,
      {
        clienteId: cliente.clienteId,
        nuevoCliente: cliente.clienteId ? null : cliente.nuevo,
        crearEquipos,
        crearOrdenes,
        usuarioId: usuarioActual.id,
        empresaId: empresaActiva.id,
      },
      setMensaje,
    )
    if (r.error) {
      setError(r.error)
      if (!r.contratoId) {
        setPaso("revision")
        return
      }
    }
    await limpiarLote(lote.id)
    setResultado({ contratoId: r.contratoId, pasos: r.pasos })
    setPaso("listo")
  }

  async function cancelar() {
    if (lote) await limpiarLote(lote.id)
    setLote(null)
    setExtraccion(null)
    setArchivos([])
    setError(null)
    setPaso("subir")
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/contratos" />} nativeButton={false} aria-label="Volver">
          <ArrowLeft />
        </Button>
        <PageHeader
          title="Nuevo contrato desde documentos"
          description="Sube el contrato, su ficha o anexo técnico y, si la tienes, la póliza de fianza. La IA los lee y te muestra todo para revisar antes de guardar."
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {paso === "subir" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Documentos del contrato</CardTitle>
            <CardDescription>
              PDF (también escaneados), Word o imagen. Hasta {MAX_ARCHIVOS_IMPORTACION} archivos y{" "}
              {MAX_BYTES_TOTAL_IMPORTACION / 1024 / 1024} MB en total.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40">
              <Upload className="size-8 text-muted-foreground" />
              <span className="font-medium">Elige o arrastra los archivos</span>
              <span className="text-sm text-muted-foreground">Contrato · Anexo / ficha técnica · Póliza de fianza</span>
              <input type="file" multiple accept={ACCEPT_IMPORTACION} className="sr-only" onChange={(e) => { agregar(e.target.files); e.target.value = "" }} />
            </label>
            {archivos.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {archivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatoTamano(f.size)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${f.name}`} onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button className="self-start" onClick={analizar} disabled={archivos.length === 0}>
              <Sparkles data-icon="inline-start" />
              Leer documentos con IA
            </Button>
          </CardContent>
        </Card>
      )}

      {(paso === "analizando" || paso === "guardando") && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner className="size-8" />
            <p className="font-medium">{mensaje}</p>
            <p className="text-sm text-muted-foreground">No cierres esta página.</p>
          </CardContent>
        </Card>
      )}

      {paso === "revision" && extraccion && lote && (
        <>
          {extraccion.advertencias.length > 0 && (
            <Alert>
              <AlertTitle>Revisa estos puntos</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5">
                  {extraccion.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <RevisionImportacion
            valor={extraccion}
            onChange={setExtraccion}
            archivos={lote.archivos}
            clientes={clientes}
            cliente={cliente}
            onCliente={setCliente}
            sugerenciasUbicacion={sugerencias}
          />
          <Card>
            <CardHeader><CardTitle>Al confirmar</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field orientation="horizontal" className="items-center">
                <Switch id="imp-equipos" checked={crearEquipos} onCheckedChange={setCrearEquipos} />
                <FieldLabel htmlFor="imp-equipos">Registrar los equipos de cada partida (uno por unidad, con su ubicación)</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="items-center">
                <Switch id="imp-ordenes" checked={crearOrdenes} onCheckedChange={setCrearOrdenes} />
                <FieldLabel htmlFor="imp-ordenes">Generar una orden de servicio por partida, con sus equipos</FieldLabel>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={confirmar}>
                  <CheckCircle2 data-icon="inline-start" />
                  Confirmar y registrar
                </Button>
                <Button variant="outline" onClick={cancelar}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {paso === "listo" && resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              {error ? "Registro parcial" : "Contrato registrado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="list-disc pl-5 text-sm">
              {resultado.pasos.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            {resultado.contratoId && (
              <Button
                className="self-start"
                onClick={() => {
                  // Recarga completa para que el resto de la app vea los equipos y órdenes nuevos.
                  window.location.assign(`/contratos/${resultado.contratoId}`)
                }}
              >
                Ver el contrato
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

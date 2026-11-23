"use client"

import * as React from "react"
import { Download, Eye, FileText, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { BUCKET_EXPEDIENTES, formatoTamano } from "@/lib/contratos"
import { formatFechaHora } from "@/lib/format"
import {
  TIPOS_DOCUMENTO_LICITACION,
  lecturaVencida,
  mapEstadoLectura,
  type DocumentoLicitacion,
  type TipoDocumentoLicitacion,
} from "@/lib/licitaciones"
import {
  aplicarLectura,
  estadoPorResultado,
  eventosNuevos,
  requisitosNuevos,
  type SeccionesAplicar,
} from "@/lib/licitaciones-aplicar"
import { normalizarLecturaLicitacion, type LecturaLicitacion } from "@/lib/licitaciones-lectura"
import { createClient } from "@/lib/supabase/client"
import type { DatosLicitacion } from "./use-licitacion"

const LEGIBLES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
])

/** Tipo sugerido por el nombre del archivo (el usuario lo puede cambiar). */
export function tipoPorNombre(nombre: string): TipoDocumentoLicitacion {
  const n = nombre.toLowerCase()
  if (/acta[_\s-]*fa|fallo/.test(n)) return "Acta de fallo"
  if (/acta[_\s-]*ja|junta|aclaraci/.test(n)) return "Junta de aclaraciones"
  if (/apertura|acta[_\s-]*pa/.test(n)) return "Acta de apertura"
  if (/acuse|comprasmx|compras[_\s-]*mx/.test(n)) return "Acuse ComprasMX"
  if (/anexo[_\s-]*(b|eval|puntos)|criterio/.test(n)) return "Anexo de evaluación (puntos)"
  if (/admtvo|administrativ/.test(n)) return "Anexo administrativo"
  if (/anexo[_\s-]*t|tecnic/.test(n) && !/propuesta/.test(n)) return "Anexo técnico"
  if (/propuesta.*econ|econ.*propuesta/.test(n)) return "Propuesta económica"
  if (/propuesta.*tec|tec.*propuesta/.test(n)) return "Propuesta técnica"
  if (/visita/.test(n)) return "Evidencia de visita"
  if (/contrato/.test(n)) return "Contrato"
  if (/convocatoria|bases|invitaci/.test(n)) return "Convocatoria"
  return "Otro"
}

const SECCIONES_TODAS: SeccionesAplicar = {
  datos: true,
  fechas: true,
  partidas: true,
  puntos: true,
  requisitos: true,
  analisis: true,
  resultado: true,
}

export function DocumentosLicitacion({
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
  const { licitacion, documentos } = datos
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [pendientes, setPendientes] = React.useState<{ archivo: File; tipo: TipoDocumentoLicitacion }[]>([])
  const [subiendo, setSubiendo] = React.useState(false)
  const [leyendo, setLeyendo] = React.useState<string | null>(null)
  const [lectura, setLectura] = React.useState<{ doc: DocumentoLicitacion; lectura: LecturaLicitacion } | null>(null)

  function elegir(files: FileList | null) {
    if (!files) return
    setPendientes((p) => [...p, ...Array.from(files).map((archivo) => ({ archivo, tipo: tipoPorNombre(archivo.name) }))])
    if (inputRef.current) inputRef.current.value = ""
  }

  async function subir() {
    if (!pendientes.length) return
    setSubiendo(true)
    try {
      const r = await fetch(`/api/licitaciones/${licitacion.id}/documentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archivos: pendientes.map((p) => ({ nombre: p.archivo.name, tipo: p.archivo.type, tamano: p.archivo.size })),
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? "No se pudo preparar la subida.")
      const supabase = createClient()
      for (const s of d.subidas as { indice: number; ruta: string; token: string }[]) {
        const p = pendientes[s.indice]
        const { error: e1 } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .uploadToSignedUrl(s.ruta, s.token, p.archivo, { contentType: p.archivo.type })
        if (e1) throw new Error(`No se pudo subir “${p.archivo.name}”.`)
        const { error: e2 } = await supabase.from("licitacion_documentos").insert({
          licitacion_id: licitacion.id,
          tipo: p.tipo,
          nombre_archivo: p.archivo.name,
          storage_path: s.ruta,
          mime_type: p.archivo.type,
          tamano_bytes: p.archivo.size,
        })
        if (e2) throw new Error(`Se subió “${p.archivo.name}” pero no se pudo registrar.`)
      }
      toast.success(`${pendientes.length} documento(s) guardados.`)
      setPendientes([])
      await onCambio()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudieron subir los documentos.")
    } finally {
      setSubiendo(false)
    }
  }

  // Consulta el estado guardado hasta que la lectura termine (corre en segundo plano).
  const esperar = React.useCallback(
    async (doc: DocumentoLicitacion) => {
      setLeyendo(doc.id)
      const supabase = createClient()
      try {
        for (;;) {
          await new Promise((r) => setTimeout(r, 5000))
          const { data } = await supabase.from("licitacion_documentos").select("lectura").eq("id", doc.id).maybeSingle()
          const e = mapEstadoLectura(data?.lectura)
          if (!e || lecturaVencida(e)) {
            toast.error("La lectura tardó demasiado y se canceló. Intenta de nuevo; si se repite, divide el PDF en partes.")
            return
          }
          if (e.estado === "error") {
            toast.error(e.error || "No se pudo leer el documento.")
            return
          }
          if (e.estado === "lista") {
            setLectura({ doc, lectura: normalizarLecturaLicitacion(e.lectura) })
            void onCambio()
            return
          }
        }
      } finally {
        setLeyendo(null)
      }
    },
    [onCambio],
  )

  // Si al abrir la página hay una lectura en curso (p. ej. se recargó), sigue esperándola.
  const reanudada = React.useRef(false)
  React.useEffect(() => {
    if (reanudada.current) return
    const enCurso = documentos.find((d) => d.lectura?.estado === "leyendo" && !lecturaVencida(d.lectura))
    if (enCurso) {
      reanudada.current = true
      void esperar(enCurso)
    }
  }, [documentos, esperar])

  async function leer(doc: DocumentoLicitacion) {
    setLeyendo(doc.id)
    try {
      const r = await fetch(`/api/licitaciones/${licitacion.id}/analizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentoId: doc.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? `No se pudo iniciar la lectura (error ${r.status}).`)
    } catch (e) {
      setLeyendo(null)
      toast.error(e instanceof Error ? e.message : "No se pudo iniciar la lectura.")
      return
    }
    await esperar(doc)
  }

  function verLectura(doc: DocumentoLicitacion) {
    if (doc.lectura?.estado !== "lista") return
    setLectura({ doc, lectura: normalizarLecturaLicitacion(doc.lectura.lectura) })
  }

  async function descargar(doc: DocumentoLicitacion) {
    const { data, error } = await createClient()
      .storage.from(BUCKET_EXPEDIENTES)
      .createSignedUrl(doc.storagePath, 120, { download: doc.nombreArchivo })
    if (error || !data) return toast.error("No se pudo abrir el documento.")
    window.open(data.signedUrl, "_blank", "noopener")
  }

  async function cambiarTipo(doc: DocumentoLicitacion, tipo: TipoDocumentoLicitacion) {
    const { error } = await createClient().from("licitacion_documentos").update({ tipo }).eq("id", doc.id)
    if (error) return toast.error("No se pudo cambiar el tipo.")
    await onCambio()
  }

  async function eliminar(doc: DocumentoLicitacion) {
    if (!window.confirm(`¿Eliminar “${doc.nombreArchivo}”? No se puede deshacer.`)) return
    const supabase = createClient()
    const { error } = await supabase.from("licitacion_documentos").delete().eq("id", doc.id)
    if (error) return toast.error("No se pudo eliminar.")
    await supabase.storage.from(BUCKET_EXPEDIENTES).remove([doc.storagePath])
    await onCambio()
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeGestionar && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Subir documentos</span>
            <span className="text-sm text-muted-foreground">
              Convocatoria, anexos, actas (junta, apertura, fallo), propuestas o el acuse de ComprasMX. Luego toca
              “Leer con IA” en cada uno: la convocatoria y sus anexos arman requisitos, puntos y fechas; el acta de fallo, el
              análisis del resultado.
            </span>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => elegir(e.target.files)}
          />
          {pendientes.length > 0 && (
            <div className="flex flex-col gap-2">
              {pendientes.map((p, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-md bg-muted/50 p-2 sm:flex-row sm:items-center">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {p.archivo.name} <span className="text-muted-foreground">({formatoTamano(p.archivo.size)})</span>
                  </span>
                  <SelectorTipo
                    valor={p.tipo}
                    onCambio={(tipo) => setPendientes((l) => l.map((x, j) => (j === i ? { ...x, tipo } : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar"
                    onClick={() => setPendientes((l) => l.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={subiendo}>
              <FileText data-icon="inline-start" />
              Elegir archivos
            </Button>
            {pendientes.length > 0 && (
              <Button onClick={subir} disabled={subiendo}>
                {subiendo ? <Spinner data-icon="inline-start" /> : <Upload data-icon="inline-start" />}
                Subir {pendientes.length} archivo(s)
              </Button>
            )}
          </div>
        </div>
      )}

      {documentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay documentos.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documentos.map((d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate font-medium">{d.nombreArchivo}</span>
                <span className="text-xs text-muted-foreground">
                  {formatoTamano(d.tamanoBytes)} · subido {formatFechaHora(d.createdAt)}
                  {d.analizadoAt ? ` · leído con IA ${formatFechaHora(d.analizadoAt)}` : ""}
                </span>
              </div>
              {puedeGestionar ? (
                <SelectorTipo valor={d.tipo} onCambio={(t) => void cambiarTipo(d, t)} />
              ) : (
                <Badge variant="secondary">{d.tipo}</Badge>
              )}
              <div className="flex gap-1">
                {puedeGestionar && d.lectura?.estado === "lista" && leyendo !== d.id && (
                  <Button size="sm" variant="secondary" onClick={() => verLectura(d)}>
                    <Eye data-icon="inline-start" />
                    Ver lectura
                  </Button>
                )}
                {puedeGestionar && LEGIBLES.has(d.mimeType) && (
                  <Button size="sm" variant={d.analizadoAt ? "outline" : "default"} onClick={() => leer(d)} disabled={leyendo !== null}>
                    {leyendo === d.id ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                    {leyendo === d.id ? "Leyendo…" : d.analizadoAt ? "Leer de nuevo" : "Leer con IA"}
                  </Button>
                )}
                <Button size="icon" variant="ghost" aria-label="Descargar" onClick={() => descargar(d)}>
                  <Download />
                </Button>
                {puedeEliminar && (
                  <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => eliminar(d)}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {leyendo && (
            <p className="text-sm text-muted-foreground">
              La IA está leyendo el documento completo; puede tardar de 1 a 5 minutos según el número de páginas. Puedes
              salir de esta pantalla: la lectura sigue y al volver la verás con “Ver lectura”.
            </p>
          )}
        </div>
      )}

      {lectura && (
        <AplicarLecturaDialog
          datos={datos}
          nombre={lectura.doc.nombreArchivo}
          lectura={lectura.lectura}
          onClose={() => setLectura(null)}
          onAplicada={async () => {
            setLectura(null)
            await onCambio()
          }}
        />
      )}
    </div>
  )
}

function SelectorTipo({ valor, onCambio }: { valor: TipoDocumentoLicitacion; onCambio: (t: TipoDocumentoLicitacion) => void }) {
  return (
    <Select
      value={valor}
      onValueChange={(v) => onCambio(v as TipoDocumentoLicitacion)}
      items={TIPOS_DOCUMENTO_LICITACION.map((t) => ({ value: t, label: t }))}
    >
      <SelectTrigger className="sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIPOS_DOCUMENTO_LICITACION.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AplicarLecturaDialog({
  datos,
  nombre,
  lectura,
  onClose,
  onAplicada,
}: {
  datos: DatosLicitacion
  nombre: string
  lectura: LecturaLicitacion
  onClose: () => void
  onAplicada: () => Promise<void>
}) {
  const [s, setS] = React.useState<SeccionesAplicar>(SECCIONES_TODAS)
  const [aplicando, setAplicando] = React.useState(false)
  const reqNuevos = requisitosNuevos(lectura, datos.requisitos)
  const evNuevos = eventosNuevos(lectura, datos.eventos)
  const estado = estadoPorResultado(lectura)
  const d = lectura.datos

  const filas: { clave: keyof SeccionesAplicar; titulo: string; detalle: string; hay: boolean }[] = [
    {
      clave: "datos",
      titulo: "Datos del procedimiento",
      detalle: [d.numero, d.dependencia, d.criterio_evaluacion].filter(Boolean).join(" · ") || "—",
      hay: !!(d.numero || d.objeto || d.dependencia || d.criterio_evaluacion),
    },
    {
      clave: "fechas",
      titulo: "Fechas y recordatorios",
      detalle: `${evNuevos.length} nueva(s): ${evNuevos.slice(0, 4).map((e) => `${e.tipo} ${e.fecha}`).join(", ")}${evNuevos.length > 4 ? "…" : ""}`,
      hay: evNuevos.length > 0,
    },
    {
      clave: "partidas",
      titulo: "Partidas",
      detalle: `${lectura.partidas.length} leída(s)`,
      hay: lectura.partidas.length > 0,
    },
    {
      clave: "puntos",
      titulo: "Tabla de puntos",
      detalle: `${lectura.tabla_puntos.length} criterio(s), ${Math.round(lectura.tabla_puntos.reduce((t, c) => t + c.maximo, 0) * 100) / 100} puntos; crea su requisito de seguimiento`,
      hay: lectura.tabla_puntos.length > 0,
    },
    {
      clave: "requisitos",
      titulo: "Requisitos",
      detalle: `${reqNuevos.length} nuevo(s), ${reqNuevos.filter((r) => r.desecha).length} con riesgo de desechamiento`,
      hay: reqNuevos.length > 0,
    },
    {
      clave: "analisis",
      titulo: "Análisis y recomendaciones",
      detalle: `${lectura.analisis.recomendaciones.length} recomendación(es), ${lectura.analisis.causales_desechamiento.length} causal(es) de desechamiento`,
      hay: !!(lectura.analisis.resumen || lectura.analisis.recomendaciones.length || lectura.analisis.riesgos.length),
    },
    {
      clave: "resultado",
      titulo: "Resultado del fallo",
      detalle: lectura.resultado
        ? `${lectura.resultado.nuestras.length} partida(s) nuestra(s)${estado ? ` · estado: ${estado}` : ""}`
        : "—",
      hay: !!lectura.resultado,
    },
  ]

  async function aplicar() {
    setAplicando(true)
    const r = await aplicarLectura(createClient(), datos.licitacion, lectura, datos.requisitos, datos.eventos, s)
    setAplicando(false)
    if (!r.ok) return toast.error(r.error)
    toast.success(
      `Aplicado: ${r.resumen.requisitosNuevos} requisito(s), ${r.resumen.fechasNuevas} fecha(s), ${r.resumen.criteriosNuevos} criterio(s) de puntos.`,
    )
    await onAplicada()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lectura de “{nombre}”</DialogTitle>
          <DialogDescription>
            La IA lo identificó como <strong>{lectura.tipo_documento}</strong>. Elige qué agregar a la licitación; no se
            borra nada de lo que ya tienes y no se repiten requisitos ni fechas.
          </DialogDescription>
        </DialogHeader>
        {lectura.analisis.resumen && <p className="text-sm">{lectura.analisis.resumen}</p>}
        {lectura.resultado?.resumen && <p className="text-sm">{lectura.resultado.resumen}</p>}
        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {filas
            .filter((f) => f.hay)
            .map((f) => (
              <div key={f.clave} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <div className="flex min-w-0 flex-col">
                  <Label htmlFor={`ap-${f.clave}`}>{f.titulo}</Label>
                  <span className="truncate text-xs text-muted-foreground">{f.detalle}</span>
                </div>
                <Switch id={`ap-${f.clave}`} checked={s[f.clave]} onCheckedChange={(v) => setS((x) => ({ ...x, [f.clave]: v }))} />
              </div>
            ))}
          {filas.every((f) => !f.hay) && <p className="text-sm text-muted-foreground">No se encontró nada nuevo que agregar.</p>}
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
          <Button onClick={aplicar} disabled={aplicando || filas.every((f) => !f.hay)}>
            {aplicando && <Spinner data-icon="inline-start" />}
            Aplicar a la licitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

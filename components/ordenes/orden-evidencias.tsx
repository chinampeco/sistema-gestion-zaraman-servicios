"use client"

import * as React from "react"
import { Upload, Trash2, ImageIcon, LockKeyhole } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { puedeReasignarOrdenes } from "@/lib/permisos"
import { createClient } from "@/lib/supabase/client"
import { hoyISO } from "@/lib/format"
import {
  FASES_EVIDENCIA,
  type EvidenciaOrden,
  type FaseEvidencia,
  type OrdenServicio,
} from "@/lib/types"

const BUCKET = "evidencias"

export function OrdenEvidencias({ orden }: { orden: OrdenServicio }) {
  const { actualizarOrden, usuarioActual } = useStore()
  const [fase, setFase] = React.useState<FaseEvidencia>("Durante")
  const [subiendo, setSubiendo] = React.useState(false)
  const [urls, setUrls] = React.useState<Record<string, string>>({})
  const inputRef = React.useRef<HTMLInputElement>(null)
  const bloqueada = Boolean(orden.firmaCliente)
  const esTecnicoAsignado =
    usuarioActual.rol === "Técnico" &&
    usuarioActual.tecnicoId != null &&
    usuarioActual.tecnicoId === orden.tecnicoId
  const puedeEditar = !bloqueada && (esTecnicoAsignado || puedeReasignarOrdenes(usuarioActual.rol))

  const evidencias = orden.evidencias

  React.useEffect(() => {
    let activo = true
    const cargarUrls = async () => {
      const supabase = createClient()
      const entradas = await Promise.all(
        evidencias
          .filter((ev) => Boolean(ev.path))
          .map(async (ev) => {
            const { data, error } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(ev.path, 3600)
            return error || !data?.signedUrl ? null : [ev.path, data.signedUrl] as const
          }),
      )
      if (!activo) return
      setUrls(Object.fromEntries(entradas.filter(Boolean) as Array<readonly [string, string]>))
    }
    void cargarUrls()
    return () => {
      activo = false
    }
  }, [evidencias])

  const handleUpload = async (files: FileList | null) => {
    if (!puedeEditar) {
      toast.error(
        bloqueada
          ? "Las evidencias están bloqueadas después de la firma del cliente."
          : "Solo el técnico asignado o un usuario autorizado puede agregar evidencias.",
      )
      return
    }
    if (!files || files.length === 0) return
    setSubiendo(true)
    const supabase = createClient()
    try {
      const nuevas: EvidenciaOrden[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} no es una imagen válida.`)
          continue
        }
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${orden.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
        if (error) {
          toast.error(`No se pudo subir ${file.name}.`)
          continue
        }
        nuevas.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: "",
          path,
          fase,
          descripcion: file.name,
          fecha: hoyISO(),
        })
      }
      if (nuevas.length > 0) {
        await actualizarOrden(orden.id, { evidencias: [...evidencias, ...nuevas] })
        toast.success(`${nuevas.length} evidencia${nuevas.length > 1 ? "s" : ""} agregada${nuevas.length > 1 ? "s" : ""}.`)
      }
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const eliminar = async (ev: EvidenciaOrden) => {
    if (!puedeEditar) {
      toast.error(
        bloqueada
          ? "Las evidencias están bloqueadas después de la firma del cliente."
          : "Solo el técnico asignado o un usuario autorizado puede eliminar evidencias.",
      )
      return
    }
    const supabase = createClient()
    const { error } = await supabase.storage.from(BUCKET).remove([ev.path])
    if (error) {
      toast.error("No se pudo eliminar el archivo.")
      return
    }
    await actualizarOrden(orden.id, { evidencias: evidencias.filter((e) => e.id !== ev.id) })
    toast.success("Evidencia eliminada.")
  }

  return (
    <div className="flex flex-col gap-4">
      {bloqueada ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <LockKeyhole className="size-4" />
          Evidencias bloqueadas después de la firma del cliente.
        </div>
      ) : puedeEditar ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Fase</label>
            <Select value={fase} onValueChange={(v) => setFase(v as FaseEvidencia)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES_EVIDENCIA.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={subiendo}>
            <Upload data-icon="inline-start" />
            {subiendo ? "Subiendo..." : "Subir fotos"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Solo el técnico asignado y los responsables de operación pueden modificar evidencias.
        </p>
      )}

      {evidencias.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
          <ImageIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aún no hay evidencias fotográficas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {evidencias.map((ev) => (
            <figure key={ev.id} className="group relative overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[ev.path] || "/placeholder.svg"} alt={ev.descripcion || "Evidencia"} className="aspect-square w-full object-cover" crossOrigin="anonymous" />
              <figcaption className="flex items-center justify-between gap-1 p-2">
                <Badge variant="outline" className="text-xs">{ev.fase}</Badge>
                {puedeEditar ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => eliminar(ev)} aria-label="Eliminar evidencia">
                    <Trash2 />
                  </Button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

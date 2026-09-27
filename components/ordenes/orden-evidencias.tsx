"use client"

import * as React from "react"
import { Upload, Trash2, ImageIcon } from "lucide-react"
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
  const { actualizarOrden } = useStore()
  const [fase, setFase] = React.useState<FaseEvidencia>("Durante")
  const [subiendo, setSubiendo] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const evidencias = orden.evidencias

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setSubiendo(true)
    const supabase = createClient()
    try {
      const nuevas: EvidenciaOrden[] = []
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg"
        const path = `${orden.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false })
        if (error) {
          toast.error(`No se pudo subir ${file.name}.`)
          continue
        }
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        nuevas.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url: data.publicUrl,
          path,
          fase,
          descripcion: file.name,
          fecha: hoyISO(),
        })
      }
      if (nuevas.length > 0) {
        await actualizarOrden(orden.id, { evidencias: [...evidencias, ...nuevas] })
        toast.success(
          `${nuevas.length} evidencia${nuevas.length > 1 ? "s" : ""} agregada${
            nuevas.length > 1 ? "s" : ""
          }.`
        )
      }
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const eliminar = async (ev: EvidenciaOrden) => {
    const supabase = createClient()
    await supabase.storage.from(BUCKET).remove([ev.path])
    await actualizarOrden(orden.id, {
      evidencias: evidencias.filter((e) => e.id !== ev.id),
    })
    toast.success("Evidencia eliminada.")
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Fase</label>
          <Select value={fase} onValueChange={(v) => setFase(v as FaseEvidencia)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FASES_EVIDENCIA.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
        >
          <Upload data-icon="inline-start" />
          {subiendo ? "Subiendo..." : "Subir fotos"}
        </Button>
      </div>

      {evidencias.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
          <ImageIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aún no hay evidencias fotográficas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {evidencias.map((ev) => (
            <figure
              key={ev.id}
              className="group relative overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ev.url || "/placeholder.svg"}
                alt={ev.descripcion || "Evidencia"}
                className="aspect-square w-full object-cover"
                crossOrigin="anonymous"
              />
              <figcaption className="flex items-center justify-between gap-1 p-2">
                <Badge variant="outline" className="text-xs">
                  {ev.fase}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => eliminar(ev)}
                  aria-label="Eliminar evidencia"
                >
                  <Trash2 />
                </Button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

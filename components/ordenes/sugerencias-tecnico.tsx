"use client"

import * as React from "react"
import { AlertTriangle, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { hoyISO } from "@/lib/format"
import { useStore } from "@/lib/store"
import { sugerirTecnicos, type Sugerencia } from "@/lib/sugerencia-tecnicos"
import { createClient } from "@/lib/supabase/client"
import { documentosDeAccesoVencidos, mapDocumentoTecnico } from "@/lib/tecnico-documentos"
import type { OrdenServicio } from "@/lib/types"

/** Los técnicos más aptos para la orden; al tocar uno se elige. Solo es una sugerencia. */
export function SugerenciasTecnico({
  orden,
  seleccionado,
  onElegir,
}: {
  orden: OrdenServicio
  seleccionado: string
  onElegir: (tecnicoId: string) => void
}) {
  const { tecnicos, ordenes, equipos, clientes } = useStore()
  const [extra, setExtra] = React.useState<{ retrabajo: Set<string>; vencidos: Map<string, string[]> } | null>(null)

  React.useEffect(() => {
    let vivo = true
    const supabase = createClient()
    Promise.all([
      supabase.from("orden_garantias").select("orden_origen_id").not("orden_origen_id", "is", null),
      supabase.from("tecnico_documentos").select("*"),
    ]).then(([garantias, docs]) => {
      if (!vivo) return
      const porTecnico = new Map<string, ReturnType<typeof mapDocumentoTecnico>[]>()
      for (const d of (docs.data ?? []).map(mapDocumentoTecnico)) {
        porTecnico.set(d.tecnicoId, [...(porTecnico.get(d.tecnicoId) ?? []), d])
      }
      const vencidos = new Map<string, string[]>()
      for (const [id, lista] of porTecnico) {
        const v = documentosDeAccesoVencidos(lista, hoyISO())
        if (v.length) vencidos.set(id, v)
      }
      setExtra({
        retrabajo: new Set((garantias.data ?? []).map((g: any) => g.orden_origen_id as string)),
        vencidos,
      })
    })
    return () => {
      vivo = false
    }
  }, [])

  const sugerencias: Sugerencia[] = React.useMemo(
    () =>
      extra
        ? sugerirTecnicos(orden, {
            tecnicos,
            ordenes,
            equipos,
            clientes,
            ordenesConRetrabajo: extra.retrabajo,
            documentosVencidos: extra.vencidos,
          })
        : [],
    [extra, orden, tecnicos, ordenes, equipos, clientes],
  )

  if (!extra) return <p className="text-xs text-muted-foreground">Calculando sugerencias…</p>
  if (sugerencias.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="size-4 text-primary" />
        Técnicos sugeridos
      </span>
      <div className="flex flex-col gap-2">
        {sugerencias.map((s, i) => (
          <button
            key={s.tecnico.id}
            type="button"
            onClick={() => onElegir(s.tecnico.id)}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
              seleccionado === s.tecnico.id ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {i + 1}. {s.tecnico.nombre}
                <span className="font-normal text-muted-foreground"> · {s.tecnico.rol}</span>
              </span>
              <Badge variant={i === 0 ? "default" : "secondary"}>{s.puntos}/100</Badge>
            </div>
            {s.motivos.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.motivos.join(" · ")}</p>}
            {s.alertas.length > 0 && (
              <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                {s.alertas.join(" · ")}
              </p>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Es una sugerencia según su perfil, servicios terminados, ubicación y carga de trabajo. Puedes elegir a cualquier técnico.
      </p>
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { Gavel } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatFechaHora } from "@/lib/format"
import { diasPara, eventoPorAtender, mapEvento, textoDias, type EventoLicitacion } from "@/lib/licitaciones"
import { puedeVerModulo } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

/** Fechas de licitaciones dentro de su ventana de aviso (para Notificaciones). */
export function AvisosLicitaciones() {
  const { usuarioActual, empresaActiva } = useStore()
  const visible = puedeVerModulo(usuarioActual.rol, "licitaciones")
  const [avisos, setAvisos] = React.useState<(EventoLicitacion & { procedimiento: string })[]>([])

  React.useEffect(() => {
    if (!visible) return
    let vigente = true
    createClient()
      .from("licitacion_eventos")
      .select("*, licitaciones(numero, objeto, estado)")
      .eq("completado", false)
      .order("fecha")
      .then(({ data }) => {
        if (!vigente) return
        setAvisos(
          (data ?? [])
            .filter((r: any) => !["Cancelada", "No participó", "Perdida", "Desechada", "Desierta"].includes(r.licitaciones?.estado))
            .map((r: any) => ({ ...mapEvento(r), procedimiento: r.licitaciones?.numero || r.licitaciones?.objeto || "Licitación" }))
            .filter((e) => eventoPorAtender(e)),
        )
      })
    return () => {
      vigente = false
    }
  }, [visible, empresaActiva?.id])

  if (!visible || avisos.length === 0) return null
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Licitaciones</CardTitle>
        <Badge variant="secondary" className="font-normal">
          {avisos.length}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {avisos.map((e) => {
            const dias = diasPara(e.fecha)
            return (
              <li key={e.id}>
                <Link
                  href={`/licitaciones/${e.licitacionId}?tab=fechas`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <Gavel className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {e.titulo || e.tipo} ({textoDias(dias)})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {e.procedimiento} · {formatFechaHora(e.fecha)}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

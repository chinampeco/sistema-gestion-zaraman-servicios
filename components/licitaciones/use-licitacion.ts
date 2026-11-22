"use client"

import * as React from "react"

import {
  mapDocumentoLicitacion,
  mapEvento,
  mapLicitacion,
  mapRequisito,
  type DocumentoLicitacion,
  type EventoLicitacion,
  type Licitacion,
  type RequisitoLicitacion,
} from "@/lib/licitaciones"
import { createClient } from "@/lib/supabase/client"

export interface DocumentoEmpresaBreve {
  id: string
  tipo: string
  descripcion: string
  vigenteHasta: string | null
}

export interface DatosLicitacion {
  licitacion: Licitacion
  documentos: DocumentoLicitacion[]
  requisitos: RequisitoLicitacion[]
  eventos: EventoLicitacion[]
  documentosEmpresa: DocumentoEmpresaBreve[]
}

/** Carga la licitación con sus documentos, requisitos y fechas (RLS: empresa activa). */
export function useLicitacion(id: string) {
  const [datos, setDatos] = React.useState<DatosLicitacion | null>(null)
  const [noExiste, setNoExiste] = React.useState(false)

  const recargar = React.useCallback(async () => {
    const supabase = createClient()
    const [lic, docs, reqs, evs, emp] = await Promise.all([
      supabase.from("licitaciones").select("*").eq("id", id).maybeSingle(),
      supabase.from("licitacion_documentos").select("*").eq("licitacion_id", id).order("created_at"),
      supabase.from("licitacion_requisitos").select("*").eq("licitacion_id", id).order("orden"),
      supabase.from("licitacion_eventos").select("*").eq("licitacion_id", id).order("fecha"),
      supabase
        .from("empresa_documentos")
        .select("id, tipo, descripcion, vigente_hasta")
        .order("created_at", { ascending: false }),
    ])
    if (!lic.data) {
      setNoExiste(true)
      return
    }
    setDatos({
      licitacion: mapLicitacion(lic.data),
      documentos: (docs.data ?? []).map(mapDocumentoLicitacion),
      requisitos: (reqs.data ?? []).map(mapRequisito),
      eventos: (evs.data ?? []).map(mapEvento),
      documentosEmpresa: (emp.data ?? []).map((d: any) => ({
        id: d.id,
        tipo: d.tipo ?? "",
        descripcion: d.descripcion ?? "",
        vigenteHasta: d.vigente_hasta ?? null,
      })),
    })
  }, [id])

  React.useEffect(() => {
    void recargar()
  }, [recargar])

  return { datos, noExiste, recargar }
}

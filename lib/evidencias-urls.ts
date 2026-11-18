"use client"

// Las fotos de evidencia están en el bucket privado "evidencias" (carpeta
// {orden_id}/). Para mostrarlas se piden enlaces temporales con la sesión del
// usuario: la base solo los da a quien puede ver la orden.

import * as React from "react"

import { createClient } from "@/lib/supabase/client"
import type { EvidenciaOrden } from "@/lib/types"

export const BUCKET_EVIDENCIAS = "evidencias"

/** path → URL temporal (1 hora) de cada evidencia. */
export function useUrlsEvidencias(evidencias: EvidenciaOrden[] | undefined): Record<string, string> {
  const [urls, setUrls] = React.useState<Record<string, string>>({})
  const clave = (evidencias ?? []).map((e) => e.path).filter(Boolean).join("|")

  React.useEffect(() => {
    const paths = clave ? clave.split("|") : []
    if (paths.length === 0) {
      setUrls({})
      return
    }
    let activo = true
    createClient()
      .storage.from(BUCKET_EVIDENCIAS)
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!activo) return
        const mapa: Record<string, string> = {}
        for (const r of data ?? []) if (r.path && r.signedUrl) mapa[r.path] = r.signedUrl
        setUrls(mapa)
      })
    return () => {
      activo = false
    }
  }, [clave])

  return urls
}

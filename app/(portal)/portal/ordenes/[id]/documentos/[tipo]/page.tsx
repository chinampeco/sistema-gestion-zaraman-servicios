"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { DOCUMENTOS_CIERRE, DocumentoCierreVista, type ClaveDocumentoCierre } from "@/components/ordenes/documentos-cierre"
import { Button } from "@/components/ui/button"

export default function DocumentoCierrePage() {
  const { id, tipo } = useParams<{ id: string; tipo: string }>()
  if (!DOCUMENTOS_CIERRE.some((d) => d.clave === tipo)) {
    return <p className="text-sm text-muted-foreground">Documento no disponible.</p>
  }
  return (
    <DocumentoCierreVista
      ordenId={id}
      tipo={tipo as ClaveDocumentoCierre}
      alVolver={
        <Button variant="ghost" render={<Link href={`/portal/ordenes/${id}/hoja`} />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Hoja de servicio
        </Button>
      }
    />
  )
}

"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ReporteServicioPrint } from "@/components/ordenes/reporte-servicio-print"
import { useStore } from "@/lib/store"

export default function ReporteOrdenPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { ordenes, clientes, equipos, tecnicos } = useStore()

  const orden = ordenes.find((item) => item.id === params.id)

  if (!orden) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Orden no encontrada</h1>
        <Button variant="outline" onClick={() => router.push("/ordenes")}>
          <ArrowLeft data-icon="inline-start" />
          Volver a órdenes
        </Button>
      </div>
    )
  }

  const cliente = clientes.find((item) => item.id === orden.clienteId)
  const equipo = equipos.find((item) => item.id === orden.equipoId)
  const tecnico = tecnicos.find((item) => item.id === orden.tecnicoId)

  return (
    <>
      <div className="screen-detail flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Reporte de servicio · {orden.folio}</h1>
            <p className="text-sm text-muted-foreground">
              Vista de impresión. Usa “Reporte PDF” y selecciona “Guardar como PDF” en el diálogo de impresión.
            </p>
          </div>
          <Button variant="ghost" onClick={() => router.push(`/ordenes/${orden.id}`)}>
            <ArrowLeft data-icon="inline-start" />
            Volver a la orden
          </Button>
        </div>
      </div>

      <ReporteServicioPrint
        orden={orden}
        cliente={cliente}
        equipo={equipo}
        tecnico={tecnico}
      />
    </>
  )
}

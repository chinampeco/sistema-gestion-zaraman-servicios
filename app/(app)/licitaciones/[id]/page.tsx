"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { DocumentosLicitacion } from "@/components/licitaciones/documentos-licitacion"
import { FechasLicitacion } from "@/components/licitaciones/fechas-licitacion"
import { PuntosLicitacion } from "@/components/licitaciones/puntos-licitacion"
import { RequisitosLicitacion } from "@/components/licitaciones/requisitos-licitacion"
import { ResultadoLicitacion } from "@/components/licitaciones/resultado-licitacion"
import { ResumenLicitacion } from "@/components/licitaciones/resumen-licitacion"
import { useLicitacion } from "@/components/licitaciones/use-licitacion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { eventoPorAtender, varianteEstado } from "@/lib/licitaciones"
import { puedeEliminarContratos, puedeGestionarContratos } from "@/lib/permisos"
import { useStore } from "@/lib/store"

const PESTANAS = ["resumen", "requisitos", "puntos", "fechas", "documentos", "resultado"] as const

export default function LicitacionPage() {
  const { id } = useParams<{ id: string }>()
  const tabInicial = useSearchParams().get("tab")
  const { usuarioActual } = useStore()
  const { datos, noExiste, recargar } = useLicitacion(id)
  const [tab, setTab] = React.useState<string>(
    PESTANAS.includes(tabInicial as (typeof PESTANAS)[number]) ? (tabInicial as string) : "resumen",
  )
  const puedeGestionar = puedeGestionarContratos(usuarioActual.rol)
  const puedeEliminar = puedeEliminarContratos(usuarioActual.rol)

  const volver = (
    <Button variant="outline" render={<Link href="/licitaciones" />} nativeButton={false}>
      <ArrowLeft data-icon="inline-start" />
      Licitaciones
    </Button>
  )

  if (noExiste) {
    return (
      <>
        <PageHeader title="Licitación no encontrada" description="No existe o pertenece a otra empresa." actions={volver} />
      </>
    )
  }
  if (!datos) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const { licitacion: lic, requisitos, eventos } = datos
  const pendientes = requisitos.filter((r) => r.estado !== "Listo" && r.estado !== "No aplica").length
  const urgentes = eventos.filter((e) => eventoPorAtender(e)).length
  const comun = { datos, puedeGestionar, puedeEliminar, onCambio: recargar }

  return (
    <>
      <PageHeader
        title={lic.numero || "Licitación sin número"}
        description={[lic.dependencia, lic.objeto].filter(Boolean).join(" · ") || "Sube la convocatoria para empezar."}
        actions={volver}
      />
      <div className="flex flex-wrap gap-2">
        <Badge variant={varianteEstado(lic.estado)}>{lic.estado}</Badge>
        {pendientes > 0 && <Badge variant="warning">{pendientes} requisito(s) pendiente(s)</Badge>}
        {urgentes > 0 && <Badge variant="destructive">{urgentes} fecha(s) por atender</Badge>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="requisitos">Requisitos ({requisitos.length})</TabsTrigger>
            <TabsTrigger value="puntos">Puntos</TabsTrigger>
            <TabsTrigger value="fechas">Fechas ({eventos.length})</TabsTrigger>
            <TabsTrigger value="documentos">Documentos ({datos.documentos.length})</TabsTrigger>
            <TabsTrigger value="resultado">Resultado</TabsTrigger>
          </TabsList>
        </div>
        <Card className="mt-3">
          <CardContent>
            <TabsContent value="resumen">
              <ResumenLicitacion datos={datos} puedeGestionar={puedeGestionar} onCambio={recargar} />
            </TabsContent>
            <TabsContent value="requisitos">
              <RequisitosLicitacion {...comun} />
            </TabsContent>
            <TabsContent value="puntos">
              <PuntosLicitacion datos={datos} />
            </TabsContent>
            <TabsContent value="fechas">
              <FechasLicitacion {...comun} />
            </TabsContent>
            <TabsContent value="documentos">
              <DocumentosLicitacion {...comun} />
            </TabsContent>
            <TabsContent value="resultado">
              <ResultadoLicitacion datos={datos} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </>
  )
}

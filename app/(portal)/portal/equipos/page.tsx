"use client"

import { Wrench } from "lucide-react"

import { useStore } from "@/lib/store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstadoEquipoBadge } from "@/components/status-badges"
import { formatFecha } from "@/lib/format"

function Dato({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{valor || "—"}</span>
    </div>
  )
}

export default function PortalEquiposPage() {
  const { equipos, cargando } = useStore()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mis equipos</h1>
        <p className="text-sm text-muted-foreground">Equipos registrados a tu nombre y su próximo servicio.</p>
      </div>

      {equipos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {cargando ? "Cargando…" : "No tienes equipos registrados."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {equipos.map((e) => (
            <Card key={e.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Wrench className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base leading-tight">{e.tipo}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {e.marca} {e.modelo}
                    </p>
                  </div>
                </div>
                <EstadoEquipoBadge estado={e.estado} />
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <Dato label="No. de serie" valor={e.numeroSerie} />
                <Dato label="Capacidad" valor={e.capacidad} />
                <Dato label="Ubicación" valor={e.ubicacion} />
                <Dato label="Instalación" valor={formatFecha(e.fechaInstalacion)} />
                <Dato label="Último servicio" valor={formatFecha(e.fechaUltimoServicio)} />
                <Dato label="Próximo servicio" valor={formatFecha(e.fechaProximoServicio)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

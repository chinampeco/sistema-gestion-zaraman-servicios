"use client"

import Link from "next/link"
import { Bell, CheckCircle2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useStore } from "@/lib/store"
import { obtenerNotificaciones } from "@/lib/notificaciones"

const CATEGORIAS = ["Órdenes", "Tickets", "Cotizaciones", "Facturas"] as const

export default function NotificacionesPage() {
  const { ordenes, tickets, cotizaciones, facturas, usuarioActual } = useStore()
  const notificaciones = obtenerNotificaciones(
    { ordenes, tickets, cotizaciones, facturas },
    usuarioActual.rol,
  )

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bell className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Notificaciones</h1>
          <p className="text-sm text-muted-foreground">
            {notificaciones.length > 0
              ? `Tienes ${notificaciones.length} ${notificaciones.length === 1 ? "asunto" : "asuntos"} por atender`
              : "Todo al día"}
          </p>
        </div>
      </div>

      {notificaciones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CheckCircle2 className="size-6" />
            </div>
            <div>
              <p className="font-medium text-foreground">No tienes notificaciones pendientes</p>
              <p className="text-sm text-muted-foreground">
                Cuando haya órdenes, tickets, cotizaciones o facturas por atender aparecerán aquí.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        CATEGORIAS.map((categoria) => {
          const items = notificaciones.filter((n) => n.categoria === categoria)
          if (items.length === 0) return null
          return (
            <Card key={categoria}>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">{categoria}</CardTitle>
                <Badge variant="secondary" className="font-normal">
                  {items.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {items.map((n) => {
                    const Icono = n.icono
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                        >
                          <Icono className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium text-foreground">{n.titulo}</span>
                            <span className="text-xs text-muted-foreground">{n.detalle}</span>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

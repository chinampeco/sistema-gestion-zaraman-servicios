"use client"

import Link from "next/link"
import { ClipboardList, Ticket, Wrench } from "lucide-react"

import { useStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EstadoOrdenBadge, EstadoTicketBadge } from "@/components/status-badges"
import { formatFecha } from "@/lib/format"

export default function PortalInicioPage() {
  const { usuarioActual, clientes, ordenes, equipos, tickets, cargando } = useStore()

  const cliente = clientes.find((c) => c.id === usuarioActual.clienteId) ?? null
  const ordenesActivas = ordenes.filter((o) => o.estado !== "Terminada" && o.estado !== "Cancelada")
  const ticketsAbiertos = tickets.filter((t) => t.estado !== "Cerrado" && t.estado !== "Cancelado")
  const ordenesRecientes = [...ordenes]
    .sort((a, b) => (b.fechaSolicitud ?? "").localeCompare(a.fechaSolicitud ?? ""))
    .slice(0, 5)

  const tarjetas = [
    { href: "/portal/ordenes", label: "Órdenes activas", valor: ordenesActivas.length, total: ordenes.length, icon: ClipboardList },
    { href: "/portal/equipos", label: "Equipos registrados", valor: equipos.length, total: equipos.length, icon: Wrench },
    { href: "/portal/tickets", label: "Tickets abiertos", valor: ticketsAbiertos.length, total: tickets.length, icon: Ticket },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Hola{cliente ? `, ${cliente.nombre}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Resumen de tus servicios con ZARAMAN SERVICIOS.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tarjetas.map((t) => {
          const Icon = t.icon
          return (
            <Link key={t.href} href={t.href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardDescription>{t.label}</CardDescription>
                  <Icon className="size-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tabular-nums">{cargando ? "—" : t.valor}</div>
                  <p className="text-xs text-muted-foreground">de {t.total} en total</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Órdenes recientes</CardTitle>
          <CardDescription>Tus últimas solicitudes de servicio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {ordenesRecientes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {cargando ? "Cargando…" : "Aún no tienes órdenes registradas."}
            </p>
          ) : (
            ordenesRecientes.map((o) => {
              const equipo = equipos.find((e) => e.id === o.equipoId)
              return (
                <Link
                  key={o.id}
                  href="/portal/ordenes"
                  className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{o.folio}</span>
                      <EstadoOrdenBadge estado={o.estado} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {equipo ? `${equipo.tipo} · ${equipo.marca} ${equipo.modelo}` : "Sin equipo"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFecha(o.fechaSolicitud)}</span>
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}

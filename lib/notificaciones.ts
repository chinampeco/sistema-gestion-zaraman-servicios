import { ClipboardList, FileText, Receipt, Ticket, type LucideIcon } from "lucide-react"

import type { Cotizacion, Factura, OrdenServicio, RolUsuario, Ticket as TicketType } from "@/lib/types"

export type Notificacion = {
  id: string
  icono: LucideIcon
  titulo: string
  detalle: string
  href: string
  categoria: "Órdenes" | "Tickets" | "Cotizaciones" | "Facturas"
}

type Datos = {
  ordenes: OrdenServicio[]
  tickets: TicketType[]
  cotizaciones: Cotizacion[]
  facturas: Factura[]
}

// El técnico solo debe recibir avisos de SUS órdenes por atender (las que aún
// no cierra). Sus órdenes ya vienen filtradas por RLS, así que basta con
// tomar las que siguen abiertas y presentarlas como "asignada a ti".
const ESTADOS_ABIERTOS_ORDEN = [
  "Asignada",
  "Pendiente",
  "Programada",
  "En camino",
  "En proceso",
  "En espera",
]

function notificacionesTecnico(ordenes: OrdenServicio[]): Notificacion[] {
  return ordenes
    .filter((o) => ESTADOS_ABIERTOS_ORDEN.includes(o.estado))
    .map((o) => ({
      id: `orden-${o.id}`,
      icono: ClipboardList,
      // Una orden recién asignada se anuncia como novedad; el resto son sus
      // trabajos en curso.
      titulo:
        o.estado === "Asignada"
          ? `Se te ha asignado la orden ${o.folio}`
          : `Orden ${o.folio} asignada a ti`,
      detalle: `${o.tipoServicio || "Servicio"} · ${o.estado}`,
      href: `/ordenes/${o.id}`,
      categoria: "Órdenes" as const,
    }))
}

export function obtenerNotificaciones(
  { ordenes, tickets, cotizaciones, facturas }: Datos,
  rol?: RolUsuario,
): Notificacion[] {
  // Vista de campo: el técnico solo ve avisos de sus órdenes asignadas.
  if (rol === "tecnico") {
    return notificacionesTecnico(ordenes)
  }

  const ordenesPendientes = ordenes.filter((o) => o.estado === "Pendiente" || o.estado === "En espera")
  const ticketsNuevos = tickets.filter((t) => t.estado === "Nuevo")
  const cotizacionesPorRevisar = cotizaciones.filter((c) => c.estado === "Enviada" || c.estado === "Vista")
  const facturasPorCobrar = facturas.filter((f) => f.saldo > 0)

  return [
    ...ordenesPendientes.map((o) => ({
      id: `orden-${o.id}`,
      icono: ClipboardList,
      titulo: `Orden ${o.folio} ${o.estado.toLowerCase()}`,
      detalle: o.tipoServicio || "Orden de servicio por atender",
      href: `/ordenes/${o.id}`,
      categoria: "Órdenes" as const,
    })),
    ...ticketsNuevos.map((t) => ({
      id: `ticket-${t.id}`,
      icono: Ticket,
      titulo: `Ticket ${t.folio} nuevo`,
      detalle: t.descripcionFalla || "Ticket por revisar",
      href: `/tickets/${t.id}`,
      categoria: "Tickets" as const,
    })),
    ...cotizacionesPorRevisar.map((c) => ({
      id: `cotizacion-${c.id}`,
      icono: FileText,
      titulo: `Cotización ${c.folio} ${c.estado.toLowerCase()}`,
      detalle: "En espera de respuesta del cliente",
      href: `/cotizaciones/${c.id}`,
      categoria: "Cotizaciones" as const,
    })),
    ...facturasPorCobrar.map((f) => ({
      id: `factura-${f.id}`,
      icono: Receipt,
      titulo: `Factura ${f.folio} con saldo`,
      detalle: `Saldo pendiente por cobrar: ${f.saldo.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
      })}`,
      href: `/facturas/${f.id}`,
      categoria: "Facturas" as const,
    })),
  ]
}

export function contarNotificaciones(datos: Datos, rol?: RolUsuario): number {
  return obtenerNotificaciones(datos, rol).length
}

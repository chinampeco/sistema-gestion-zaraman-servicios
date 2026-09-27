import { Badge } from "@/components/ui/badge"
import {
  estadoCotizacionVariant,
  estadoEquipoVariant,
  estadoFacturaVariant,
  estadoOrdenVariant,
  estadoTicketVariant,
  prioridadTicketVariant,
  prioridadVariant,
} from "@/lib/format"
import type {
  EstadoCotizacion,
  EstadoEquipo,
  EstadoFactura,
  EstadoOrden,
  EstadoTicket,
  Prioridad,
  PrioridadTicket,
} from "@/lib/types"

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrden }) {
  return <Badge variant={estadoOrdenVariant(estado)}>{estado}</Badge>
}

export function EstadoEquipoBadge({ estado }: { estado: EstadoEquipo }) {
  return <Badge variant={estadoEquipoVariant(estado)}>{estado}</Badge>
}

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  return <Badge variant={prioridadVariant(prioridad)}>{prioridad}</Badge>
}

export function EstadoTicketBadge({ estado }: { estado: EstadoTicket }) {
  return <Badge variant={estadoTicketVariant(estado)}>{estado}</Badge>
}

export function EstadoCotizacionBadge({
  estado,
}: {
  estado: EstadoCotizacion
}) {
  return <Badge variant={estadoCotizacionVariant(estado)}>{estado}</Badge>
}

export function EstadoFacturaBadge({ estado }: { estado: EstadoFactura }) {
  return <Badge variant={estadoFacturaVariant(estado)}>{estado}</Badge>
}

export function PrioridadTicketBadge({
  prioridad,
}: {
  prioridad: PrioridadTicket
}) {
  return (
    <Badge variant={prioridadTicketVariant(prioridad)}>{prioridad}</Badge>
  )
}

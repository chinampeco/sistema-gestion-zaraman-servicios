import type {
  ConceptoCotizacion,
  EstadoCotizacion,
  EstadoEquipo,
  EstadoFactura,
  EstadoLead,
  EstadoOrden,
  EstadoTicket,
  Prioridad,
  PrioridadLead,
  PrioridadTicket,
} from "@/lib/types"

// Tasa de IVA por defecto (16%). Configurable a futuro desde Configuración.
export const IVA_TASA = 0.16

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"

export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "—"
  const date = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatHora(hora: string | null | undefined): string {
  if (!hora) return "—"
  const [h, m] = hora.split(":")
  if (h === undefined || m === undefined) return hora
  const date = new Date()
  date.setHours(Number(h), Number(m), 0, 0)
  if (Number.isNaN(date.getTime())) return hora
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function estadoOrdenVariant(estado: EstadoOrden): BadgeVariant {
  switch (estado) {
    case "Pendiente de asignación":
      return "warning"
    case "Pendiente":
      return "warning"
    case "Asignada":
      return "info"
  case "Programada":
  return "info"
  case "En camino":
  return "default"
  case "En proceso":
  return "default"
    case "Terminada":
      return "success"
    case "Cancelada":
      return "secondary"
    default:
      return "secondary"
  }
}

export function estadoEquipoVariant(estado: EstadoEquipo): BadgeVariant {
  switch (estado) {
    case "Operativo":
      return "success"
    case "En reparación":
      return "warning"
    case "En espera de refacción":
      return "info"
    case "Fuera de servicio":
      return "destructive"
    default:
      return "secondary"
  }
}

export function prioridadVariant(prioridad: Prioridad): BadgeVariant {
  switch (prioridad) {
    case "Normal":
      return "secondary"
    case "Alta":
      return "warning"
    case "Urgente":
      return "destructive"
    default:
      return "secondary"
  }
}

export function estadoTicketVariant(estado: EstadoTicket): BadgeVariant {
  switch (estado) {
    case "Nuevo":
      return "info"
    case "Revisado":
      return "info"
    case "Asignado":
      return "default"
    case "En atención":
      return "default"
    case "Pendiente":
      return "warning"
    case "Resuelto":
      return "success"
    case "Cerrado":
      return "secondary"
    case "Cancelado":
      return "secondary"
    default:
      return "secondary"
  }
}

export function prioridadTicketVariant(prioridad: PrioridadTicket): BadgeVariant {
  switch (prioridad) {
    case "Baja":
      return "secondary"
    case "Normal":
      return "info"
    case "Alta":
      return "warning"
    case "Urgente":
      return "destructive"
    default:
      return "secondary"
  }
}

export function estadoCotizacionVariant(estado: EstadoCotizacion): BadgeVariant {
  switch (estado) {
    case "Borrador":
      return "secondary"
    case "Enviada":
      return "info"
    case "Vista":
      return "default"
    case "Aceptada":
      return "success"
    case "Rechazada":
      return "destructive"
    case "Vencida":
      return "warning"
    default:
      return "secondary"
  }
}

export function estadoFacturaVariant(estado: EstadoFactura): BadgeVariant {
  switch (estado) {
    case "Pendiente":
      return "secondary"
    case "Emitida":
      return "info"
    case "Parcialmente pagada":
      return "warning"
    case "Pagada":
      return "success"
    case "Cancelada":
      return "destructive"
    default:
      return "secondary"
  }
}

export function estadoLeadVariant(estado: EstadoLead): BadgeVariant {
  switch (estado) {
    case "Nuevo":
      return "info"
    case "Contactado":
      return "default"
    case "Calificado":
      return "warning"
    case "Propuesta":
      return "warning"
    case "Ganado":
      return "success"
    case "Perdido":
      return "destructive"
    default:
      return "secondary"
  }
}

export function prioridadLeadVariant(prioridad: PrioridadLead): BadgeVariant {
  switch (prioridad) {
    case "Baja":
      return "secondary"
    case "Normal":
      return "info"
    case "Alta":
      return "warning"
    default:
      return "secondary"
  }
}

// Formatea una marca de tiempo (ISO con hora) a fecha y hora locales.
export function formatFechaHora(valor: string | null | undefined): string {
  if (!valor) return "—"
  const date = new Date(valor)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Formatea un número como moneda en pesos mexicanos.
export function formatMoneda(valor: number | null | undefined): string {
  const n = typeof valor === "number" && !Number.isNaN(valor) ? valor : 0
  return n.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Importe de una línea aplicando su descuento porcentual.
export function importeConcepto(c: ConceptoCotizacion): number {
  const bruto = (c.cantidad || 0) * (c.precioUnitario || 0)
  const desc = bruto * ((c.descuento || 0) / 100)
  return bruto - desc
}

export interface TotalesCotizacion {
  subtotal: number
  descuento: number
  base: number
  iva: number
  total: number
}

// Calcula los totales de una cotización a partir de sus conceptos.
export function calcularTotales(
  conceptos: ConceptoCotizacion[],
  ivaTasa = IVA_TASA,
): TotalesCotizacion {
  let subtotal = 0
  let descuento = 0
  for (const c of conceptos) {
    const bruto = (c.cantidad || 0) * (c.precioUnitario || 0)
    subtotal += bruto
    descuento += bruto * ((c.descuento || 0) / 100)
  }
  const base = subtotal - descuento
  const iva = base * ivaTasa
  const total = base + iva
  return {
    subtotal: redondear(subtotal),
    descuento: redondear(descuento),
    base: redondear(base),
    iva: redondear(iva),
    total: redondear(total),
  }
}

function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Genera el siguiente folio con formato OS-000001 a partir de los existentes.
export function siguienteFolio(foliosExistentes: string[]): string {
  const numeros = foliosExistentes
    .map((f) => Number.parseInt(f.replace(/[^0-9]/g, ""), 10))
    .filter((n) => !Number.isNaN(n))
  const max = numeros.length > 0 ? Math.max(...numeros) : 0
  return `OS-${String(max + 1).padStart(6, "0")}`
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Devuelve las iniciales (máximo 2) de un nombre completo.
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("")
}

// Nombre del técnico de una orden. Solo administrador y supervisor reciben la
// lista de técnicos (RPC listar_tecnicos_activos); para los demás roles una
// orden asignada muestra "Técnico asignado" sin nombre.
export function nombreTecnico(
  tecnicos: { id: string; nombre: string }[],
  id: string | null | undefined,
): string {
  if (!id) return "Sin asignar"
  return tecnicos.find((t) => t.id === id)?.nombre ?? "Técnico asignado"
}

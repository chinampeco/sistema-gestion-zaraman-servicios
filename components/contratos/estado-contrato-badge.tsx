import { Badge } from "@/components/ui/badge"
import type { EstadoContrato } from "@/lib/contratos"

const VARIANTE: Record<EstadoContrato, "default" | "secondary" | "outline" | "destructive"> = {
  "Por iniciar": "outline",
  "En ejecución": "default",
  Entregado: "secondary",
  Finiquitado: "secondary",
  Rescindido: "destructive",
  Cancelado: "destructive",
}

export function EstadoContratoBadge({ estado }: { estado: EstadoContrato }) {
  return <Badge variant={VARIANTE[estado] ?? "outline"}>{estado}</Badge>
}

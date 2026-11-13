import { FileSignature, FileText, PenLine, ShieldCheck, Ticket } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { ProcedenciaOrden } from "@/lib/types"

const ICONO: Record<ProcedenciaOrden, typeof Ticket> = {
  Manual: PenLine,
  Ticket: Ticket,
  Cotización: FileText,
  Garantía: ShieldCheck,
  Contrato: FileSignature,
}

// Etiqueta con el origen de la orden (captura manual, ticket, cotización, garantía o contrato).
export function ProcedenciaBadge({ procedencia }: { procedencia: ProcedenciaOrden }) {
  const Icono = ICONO[procedencia] ?? PenLine
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icono className="size-3" />
      {procedencia}
    </Badge>
  )
}

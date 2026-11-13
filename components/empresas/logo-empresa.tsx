import { Building2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Empresa } from "@/lib/types"

// Logo de la empresa, o un ícono neutro si todavía no tiene uno cargado.
export function LogoEmpresa({
  empresa,
  className,
}: {
  empresa: Pick<Empresa, "nombreComercial" | "logoPath"> | null
  className?: string
}) {
  if (empresa?.logoPath) {
    return (
      <img
        src={empresa.logoPath}
        alt={`Logo de ${empresa.nombreComercial}`}
        className={cn("shrink-0 rounded bg-white object-contain p-0.5", className)}
      />
    )
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
        className,
      )}
    >
      <Building2 className="size-5" />
    </div>
  )
}

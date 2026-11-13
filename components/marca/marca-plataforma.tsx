import { cn } from "@/lib/utils"

// Emblema corporativo de la plataforma: hexágono con tres barras ascendentes
// (las empresas del grupo y su crecimiento). Usa currentColor para adaptarse
// al tema; las barras toman el color de fondo de la página.
export function EmblemaPlataforma({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Plataforma Empresarial"
      className={cn("shrink-0", className)}
    >
      <path
        fill="currentColor"
        d="M32 2.5a5 5 0 0 1 2.5.67l21.5 12.41a5 5 0 0 1 2.5 4.33v24.18a5 5 0 0 1-2.5 4.33L34.5 60.83a5 5 0 0 1-5 0L8 48.42a5 5 0 0 1-2.5-4.33V19.91A5 5 0 0 1 8 15.58l21.5-12.41A5 5 0 0 1 32 2.5Z"
      />
      <g className="fill-background">
        <rect x="17" y="34" width="8" height="14" rx="2" />
        <rect x="28" y="26" width="8" height="22" rx="2" />
        <rect x="39" y="17" width="8" height="31" rx="2" />
      </g>
    </svg>
  )
}

// Emblema + nombre. `variante="claro"` para fondos oscuros o de color primario.
export function MarcaPlataforma({
  className,
  tamano = "md",
  variante = "normal",
}: {
  className?: string
  tamano?: "md" | "lg"
  variante?: "normal" | "claro"
}) {
  const grande = tamano === "lg"
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <EmblemaPlataforma
        className={cn(
          grande ? "size-14" : "size-11",
          variante === "claro" ? "text-primary-foreground [&_g]:fill-primary" : "text-primary",
        )}
      />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-bold tracking-[0.18em]",
            grande ? "text-2xl" : "text-lg",
            variante === "claro" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          PLATAFORMA
        </span>
        <span
          className={cn(
            "mt-1 font-medium tracking-[0.32em]",
            grande ? "text-sm" : "text-xs",
            variante === "claro" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          EMPRESARIAL
        </span>
      </div>
    </div>
  )
}

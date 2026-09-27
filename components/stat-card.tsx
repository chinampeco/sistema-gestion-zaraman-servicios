import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  hint?: string
  accent?: "default" | "warning" | "info" | "success" | "destructive"
}

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  destructive: "bg-destructive/10 text-destructive",
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            accentMap[accent]
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl font-semibold leading-none tabular-nums">
            {value}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
          {hint && <span className="text-xs text-muted-foreground/80">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

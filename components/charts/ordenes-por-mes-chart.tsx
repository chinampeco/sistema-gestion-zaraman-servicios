"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { OrdenServicio } from "@/lib/types"

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
]

const chartConfig = {
  total: {
    label: "Órdenes",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function OrdenesPorMesChart({ ordenes }: { ordenes: OrdenServicio[] }) {
  const conteo = new Array(12).fill(0)
  for (const orden of ordenes) {
    const mes = Number.parseInt(orden.fechaSolicitud.slice(5, 7), 10) - 1
    if (mes >= 0 && mes < 12) conteo[mes] += 1
  }
  const data = MESES.map((mes, i) => ({ mes, total: conteo[i] }))

  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="mes"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

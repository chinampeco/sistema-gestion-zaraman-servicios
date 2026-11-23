"use client"

import * as React from "react"
import { Calculator, ListPlus, Target } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { formatoMoneda } from "@/lib/contratos"
import { puntosEstimados, type CriterioPuntos } from "@/lib/licitaciones"
import { requisitosDePuntos } from "@/lib/licitaciones-aplicar"
import { createClient } from "@/lib/supabase/client"
import type { DatosLicitacion } from "./use-licitacion"

const r2 = (n: number) => Math.round(n * 100) / 100

export function PuntosLicitacion({
  datos,
  puedeGestionar,
  onCambio,
}: {
  datos: DatosLicitacion
  puedeGestionar: boolean
  onCambio: () => Promise<void>
}) {
  const { licitacion, requisitos } = datos
  const faltantes = requisitosDePuntos(licitacion.tablaPuntos, requisitos)
  const [creando, setCreando] = React.useState(false)

  async function crearRequisitos() {
    setCreando(true)
    const base = requisitos.reduce((m, r) => Math.max(m, r.orden), 0)
    const { error } = await createClient()
      .from("licitacion_requisitos")
      .insert(faltantes.map((r, i) => ({ ...r, licitacion_id: licitacion.id, orden: base + i + 1 })))
    setCreando(false)
    if (error) return toast.error("No se pudieron crear los requisitos de puntos.")
    toast.success(`${faltantes.length} requisito(s) de puntos agregados. Márcalos como “Listo” conforme reúnas cada documento.`)
    await onCambio()
  }
  const tabla = licitacion.tablaPuntos
  const maxTec = licitacion.puntosTecnicosMax ?? r2(tabla.reduce((t, c) => t + c.maximo, 0))
  const maxEco = licitacion.puntosEconomicosMax ?? 40
  const reqPuntos = requisitos.filter((r) => r.puntosMax != null)
  const { esperados, posibles } = puntosEstimados(requisitos)
  const faltan = reqPuntos.filter((r) => r.estado !== "Listo" && r.estado !== "No aplica")

  // Calculadora: los puntos económicos se reparten en proporción al precio más bajo.
  const [precio, setPrecio] = React.useState("")
  const [minimo, setMinimo] = React.useState("")
  const p = Number(precio.replace(/[^0-9.]/g, ""))
  const m = Number(minimo.replace(/[^0-9.]/g, ""))
  const eco = p > 0 && m > 0 ? r2(maxEco * Math.min(1, m / p)) : null

  const porRubro = new Map<string, CriterioPuntos[]>()
  for (const c of tabla) porRubro.set(c.rubro || "Criterios", [...(porRubro.get(c.rubro || "Criterios") ?? []), c])

  if (!tabla.length && !reqPuntos.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta licitación aún no tiene tabla de puntos. Si la evaluación es por puntos y porcentajes, lee con IA la convocatoria
        o el anexo del criterio de evaluación (suele ser el Anexo “B”).
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeGestionar && faltantes.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm">
            {faltantes.length} criterio(s) de la tabla no tienen requisito para darle seguimiento (
            {Math.round(faltantes.reduce((t, r) => t + (r.puntos_max ?? 0), 0) * 100) / 100} puntos).
          </span>
          <Button size="sm" onClick={crearRequisitos} disabled={creando}>
            <ListPlus data-icon="inline-start" />
            Crear requisitos de puntos
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4" />
              Puntos técnicos asegurados
            </CardTitle>
            <CardDescription>Suma de los requisitos de puntos marcados como “Listo”.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-3xl font-semibold tabular-nums">
              {esperados} <span className="text-base font-normal text-muted-foreground">de {posibles || maxTec}</span>
            </div>
            <Progress value={posibles ? (esperados / posibles) * 100 : 0} />
            {faltan.length > 0 ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Te faltan {r2(faltan.reduce((t, r) => t + (r.puntosMax ?? 0), 0))} puntos en:</span>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {faltan.map((r) => (
                    <li key={r.id}>
                      {r.descripcion} <strong className="text-foreground">({r.puntosMax} pts)</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              reqPuntos.length > 0 && <span className="text-sm text-emerald-600">Tienes todos los puntos técnicos posibles.</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-4" />
              Calculadora de precio
            </CardTitle>
            <CardDescription>
              El precio más bajo se lleva los {maxEco} puntos económicos; los demás reciben la proporción (precio más bajo ÷
              su precio). Para ganar necesitas técnico al máximo y precio competitivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="calc-precio">Tu precio (sin IVA)</FieldLabel>
                <Input id="calc-precio" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="950000" />
              </Field>
              <Field>
                <FieldLabel htmlFor="calc-min">Precio más bajo esperado</FieldLabel>
                <Input id="calc-min" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} placeholder="724140" />
                <FieldDescription>Toma el de fallos anteriores.</FieldDescription>
              </Field>
            </div>
            {eco != null && (
              <div className="rounded-md bg-muted p-3 text-sm">
                Puntos económicos: <strong>{eco}</strong> de {maxEco}. Total estimado:{" "}
                <strong>{r2(eco + (posibles ? esperados : maxTec))}</strong>.
                {p > m && (
                  <span className="block text-muted-foreground">
                    Tu precio está {Math.round((p / m - 1) * 100)} % arriba del más bajo ({formatoMoneda(p - m)} de diferencia).
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {[...porRubro.entries()].map(([rubro, criterios]) => (
        <Card key={rubro}>
          <CardHeader>
            <CardTitle className="text-base">{rubro}</CardTitle>
            <CardDescription>{r2(criterios.reduce((t, c) => t + c.maximo, 0))} puntos</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {criterios.map((c, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.clave && <span className="text-muted-foreground">{c.clave} · </span>}
                    {c.subrubro || c.descripcion}
                  </span>
                  <Badge variant="info">{c.maximo} pts máx.</Badge>
                </div>
                {c.subrubro && c.descripcion && <p className="text-sm text-muted-foreground">{c.descripcion}</p>}
                {c.como_acreditar && (
                  <p className="text-sm">
                    <span className="font-medium">Cómo acreditar: </span>
                    {c.como_acreditar}
                  </p>
                )}
                {c.niveles.length > 0 && (
                  <ul className="text-sm text-muted-foreground">
                    {c.niveles.map((n, j) => (
                      <li key={j}>
                        {n.puntos} pts — {n.condicion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

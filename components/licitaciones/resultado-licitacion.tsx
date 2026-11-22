"use client"

import { GraduationCap, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatoMoneda } from "@/lib/contratos"
import type { DatosLicitacion } from "./use-licitacion"

const dinero = (n: number | null) => (n == null ? "—" : formatoMoneda(n))
const pts = (n: number | null) => (n == null ? "—" : String(n))

export function ResultadoLicitacion({ datos }: { datos: DatosLicitacion }) {
  const r = datos.licitacion.resultado
  if (!r) {
    return (
      <p className="text-sm text-muted-foreground">
        Cuando salga el fallo, súbelo en “Documentos” como “Acta de fallo” y léelo con IA: verás en qué partidas ganaste o
        perdiste, contra quién, por cuánto precio y qué puntos te faltaron.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {r.resumen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{r.resumen}</CardContent>
        </Card>
      )}

      {r.nuestras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuestras partidas</CardTitle>
            <CardDescription>Puntos y precio contra quien ganó cada partida.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partida</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Técnico</TableHead>
                  <TableHead>Económico</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Nuestro precio</TableHead>
                  <TableHead>Ganador</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.nuestras.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.partida}</TableCell>
                    <TableCell>
                      <Badge variant={p.resultado === "Ganada" ? "success" : p.resultado === "Desechada" ? "destructive" : "secondary"}>
                        {p.resultado || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{pts(p.puntos_tecnicos)}</TableCell>
                    <TableCell>{pts(p.puntos_economicos)}</TableCell>
                    <TableCell className="font-medium">{pts(p.total)}</TableCell>
                    <TableCell className="whitespace-nowrap">{dinero(p.precio)}</TableCell>
                    <TableCell className="min-w-40 text-sm">
                      {p.ganador || "—"}
                      {p.precio_ganador != null && (
                        <span className="block text-xs text-muted-foreground">
                          {dinero(p.precio_ganador)} · {pts(p.total_ganador)} pts
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-56 text-sm">{p.motivo || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {r.puntos_perdidos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Puntos que se perdieron</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {r.puntos_perdidos.map((p, i) => (
                <div key={i} className="rounded-md border p-2">
                  <span className="font-medium">
                    {p.clave}: {pts(p.obtenidos)} de {pts(p.maximo)}
                  </span>
                  {p.motivo && <span className="block text-muted-foreground">{p.motivo}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {r.lecciones.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4" />
                Para la próxima
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
                {r.lecciones.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {r.ganadores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" />
              Adjudicados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {r.ganadores.map((g, i) => (
              <div key={i} className="flex flex-col gap-0.5 rounded-md border p-2 sm:flex-row sm:justify-between">
                <span className="font-medium">{g.empresa}</span>
                <span className="text-muted-foreground">
                  Partidas {g.partidas || "—"} · {dinero(g.monto)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

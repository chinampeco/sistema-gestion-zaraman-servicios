"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { EstadoOrdenBadge, PrioridadBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatHora } from "@/lib/format"
import type { OrdenServicio } from "@/lib/types"

type Vista = "dia" | "semana" | "mes"

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

function isoDeFecha(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
}

function fechaDeIso(iso: string) {
  const [a, m, d] = iso.split("-").map(Number)
  return new Date(a, (m ?? 1) - 1, d ?? 1)
}

function formatDiaLargo(iso: string) {
  return fechaDeIso(iso).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function inicioSemana(fecha: Date) {
  const d = new Date(fecha)
  const dia = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dia)
  d.setHours(0, 0, 0, 0)
  return d
}

export default function AgendaPage() {
  const { ordenes, clientes, equipos, tecnicos } = useStore()
  const hoy = new Date()
  const [vista, setVista] = React.useState<Vista>("mes")
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const nombreCliente = (id: string) =>
    clientes.find((c) => c.id === id)?.nombre ?? "—"
  const nombreEquipo = (id: string) => {
    const e = equipos.find((x) => x.id === id)
    return e ? `${e.tipo} · ${e.marca} ${e.modelo}`.trim() : "—"
  }
  const nombreTecnico = (id: string | null) =>
    tecnicos.find((t) => t.id === id)?.nombre ?? "Sin asignar"

  const hoyISO = isoDeFecha(hoy)

  // Rango de fechas visibles según la vista.
  const rango = React.useMemo(() => {
    if (vista === "dia") {
      const iso = isoDeFecha(cursor)
      return { dias: [iso], desde: iso, hasta: iso }
    }
    if (vista === "semana") {
      const inicio = inicioSemana(cursor)
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inicio)
        d.setDate(inicio.getDate() + i)
        return isoDeFecha(d)
      })
      return { dias, desde: dias[0], hasta: dias[6] }
    }
    // mes
    const anio = cursor.getFullYear()
    const mes = cursor.getMonth()
    const ultimo = new Date(anio, mes + 1, 0).getDate()
    const dias = Array.from({ length: ultimo }, (_, i) =>
      isoDeFecha(new Date(anio, mes, i + 1)),
    )
    return { dias, desde: dias[0], hasta: dias[dias.length - 1] }
  }, [vista, cursor])

  // Órdenes programadas dentro del rango, agrupadas por día.
  const porDia = React.useMemo(() => {
    const grupos = new Map<string, OrdenServicio[]>()
    for (const orden of ordenes) {
      if (!orden.fechaProgramada) continue
      if (orden.fechaProgramada < rango.desde || orden.fechaProgramada > rango.hasta)
        continue
      const lista = grupos.get(orden.fechaProgramada) ?? []
      lista.push(orden)
      grupos.set(orden.fechaProgramada, lista)
    }
    for (const [, lista] of grupos) {
      lista.sort((a, b) => (a.horaProgramada ?? "").localeCompare(b.horaProgramada ?? ""))
    }
    return grupos
  }, [ordenes, rango])

  // Detección de conflictos: mismo técnico, misma fecha y misma hora.
  const conflictos = React.useMemo(() => {
    const set = new Set<string>()
    const porTecnicoHora = new Map<string, OrdenServicio[]>()
    for (const [, lista] of porDia) {
      for (const o of lista) {
        if (!o.tecnicoId || !o.horaProgramada) continue
        const clave = `${o.fechaProgramada}|${o.tecnicoId}|${o.horaProgramada}`
        const arr = porTecnicoHora.get(clave) ?? []
        arr.push(o)
        porTecnicoHora.set(clave, arr)
      }
    }
    for (const [, arr] of porTecnicoHora) {
      if (arr.length > 1) arr.forEach((o) => set.add(o.id))
    }
    return set
  }, [porDia])

  const totalVisible = [...porDia.values()].reduce((n, l) => n + l.length, 0)

  const navegar = (delta: number) => {
    const d = new Date(cursor)
    if (vista === "dia") d.setDate(d.getDate() + delta)
    else if (vista === "semana") d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setCursor(d)
  }

  const irHoy = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    setCursor(d)
  }

  const tituloRango = () => {
    if (vista === "dia") return formatDiaLargo(isoDeFecha(cursor))
    if (vista === "semana") {
      const desde = fechaDeIso(rango.desde)
      const hasta = fechaDeIso(rango.hasta)
      return `${desde.getDate()} ${MESES[desde.getMonth()].slice(0, 3)} – ${hasta.getDate()} ${MESES[hasta.getMonth()].slice(0, 3)} ${hasta.getFullYear()}`
    }
    return `${MESES[cursor.getMonth()]} ${cursor.getFullYear()}`
  }

  const diasConContenido =
    vista === "mes" ? rango.dias.filter((d) => porDia.has(d)) : rango.dias

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Servicios programados por fecha."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5">
              {(["dia", "semana", "mes"] as Vista[]).map((v) => (
                <Button
                  key={v}
                  variant={vista === v ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setVista(v)}
                  className="capitalize"
                >
                  {v === "dia" ? "Día" : v}
                </Button>
              ))}
            </div>
            <Button variant="outline" onClick={irHoy}>
              <CalendarDays data-icon="inline-start" />
              Hoy
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base capitalize">{tituloRango()}</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => navegar(-1)}
                aria-label="Anterior"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => navegar(1)}
                aria-label="Siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {totalVisible === 0
              ? "Sin servicios programados en este periodo."
              : `${totalVisible} servicio${totalVisible === 1 ? "" : "s"} programado${totalVisible === 1 ? "" : "s"}.`}
            {conflictos.size > 0 && (
              <span className="ml-1 inline-flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="size-3.5" />
                {conflictos.size} con conflicto de técnico
              </span>
            )}
          </p>
        </CardHeader>
        <CardContent>
          {totalVisible === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>Nada programado</EmptyTitle>
                <EmptyDescription>
                  No hay órdenes con fecha programada en este periodo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-6">
              {diasConContenido.map((dia) => {
                const lista = porDia.get(dia) ?? []
                if (lista.length === 0) return null
                return (
                  <div key={dia} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                          dia === hoyISO
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {formatDiaLargo(dia)}
                      </span>
                      {dia === hoyISO && (
                        <span className="text-xs font-medium text-primary">Hoy</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {lista.map((o) => {
                        const enConflicto = conflictos.has(o.id)
                        return (
                          <Link
                            key={o.id}
                            href={`/ordenes/${o.id}`}
                            className={`flex flex-col gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40 ${
                              enConflicto
                                ? "border-destructive/60"
                                : "hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-medium text-primary">
                                {o.folio}
                              </span>
                              <EstadoOrdenBadge estado={o.estado} />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="size-3.5" />
                              <span className="font-medium text-foreground">
                                {o.horaProgramada ? formatHora(o.horaProgramada) : "Sin hora"}
                              </span>
                              <span aria-hidden>·</span>
                              <PrioridadBadge prioridad={o.prioridad} />
                            </div>
                            <span className="truncate text-sm font-medium">
                              {nombreCliente(o.clienteId)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {nombreEquipo(o.equipoId)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {nombreTecnico(o.tecnicoId)}
                            </span>
                            {enConflicto && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                <AlertTriangle className="size-3.5" />
                                Técnico con doble asignación a esta hora
                              </span>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

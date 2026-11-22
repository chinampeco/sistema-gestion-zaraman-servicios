"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlarmClock, Gavel, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatFechaHora } from "@/lib/format"
import {
  ESTADOS_LICITACION,
  TIPOS_PROCEDIMIENTO,
  diasPara,
  eventoPorAtender,
  mapEvento,
  mapLicitacion,
  textoDias,
  varianteEstado,
  type EventoLicitacion,
  type Licitacion,
  type TipoProcedimiento,
} from "@/lib/licitaciones"
import { puedeGestionarContratos } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

interface Avance {
  listos: number
  total: number
}

export default function LicitacionesPage() {
  const router = useRouter()
  const { usuarioActual, empresaActiva } = useStore()
  const puedeGestionar = puedeGestionarContratos(usuarioActual.rol)
  const [licitaciones, setLicitaciones] = React.useState<Licitacion[] | null>(null)
  const [avance, setAvance] = React.useState<Map<string, Avance>>(new Map())
  const [eventos, setEventos] = React.useState<EventoLicitacion[]>([])
  const [query, setQuery] = React.useState("")
  const [estado, setEstado] = React.useState("abiertas")
  const [nuevaAbierta, setNuevaAbierta] = React.useState(false)

  React.useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from("licitaciones").select("*").order("created_at", { ascending: false }),
      supabase.from("licitacion_requisitos").select("licitacion_id, estado"),
      supabase.from("licitacion_eventos").select("*").eq("completado", false).order("fecha"),
    ]).then(([lics, reqs, evs]) => {
      if (!vigente) return
      setLicitaciones((lics.data ?? []).map(mapLicitacion))
      const mapa = new Map<string, Avance>()
      for (const r of reqs.data ?? []) {
        const a = mapa.get(r.licitacion_id) ?? { listos: 0, total: 0 }
        if (r.estado !== "No aplica") {
          a.total++
          if (r.estado === "Listo") a.listos++
        }
        mapa.set(r.licitacion_id, a)
      }
      setAvance(mapa)
      setEventos((evs.data ?? []).map(mapEvento))
    })
    return () => {
      vigente = false
    }
  }, [empresaActiva?.id])

  const porId = new Map((licitaciones ?? []).map((l) => [l.id, l]))
  const porAtender = eventos.filter((e) => eventoPorAtender(e) && porId.has(e.licitacionId))
  const proximoDe = (id: string) => eventos.find((e) => e.licitacionId === id && diasPara(e.fecha) >= 0)

  const filtradas = (licitaciones ?? []).filter((l) => {
    const q = query.trim().toLowerCase()
    const coincide =
      !q || [l.numero, l.objeto, l.dependencia, l.expediente].some((v) => v.toLowerCase().includes(q))
    const abiertas = ["En preparación", "Propuesta enviada", "En evaluación"].includes(l.estado)
    return coincide && (estado === "todas" || (estado === "abiertas" ? abiertas : l.estado === estado))
  })

  return (
    <>
      <PageHeader
        title="Licitaciones"
        description={`Procedimientos en los que participa ${empresaActiva?.nombreComercial ?? "la empresa"}: requisitos, puntos, fechas y resultado.`}
        actions={
          puedeGestionar ? (
            <Button onClick={() => setNuevaAbierta(true)}>
              <Plus data-icon="inline-start" />
              Nueva licitación
            </Button>
          ) : null
        }
      />

      {porAtender.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlarmClock className="size-4 text-amber-600" />
              Fechas por atender
            </CardTitle>
            <CardDescription>Eventos próximos o vencidos que no se han marcado como hechos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {porAtender.slice(0, 8).map((e) => {
              const l = porId.get(e.licitacionId)!
              const dias = diasPara(e.fecha)
              return (
                <Link
                  key={e.id}
                  href={`/licitaciones/${l.id}?tab=fechas`}
                  className="flex flex-col gap-0.5 rounded-md border p-2 text-sm hover:bg-muted sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    <span className="font-medium">{e.titulo || e.tipo}</span>
                    <span className="text-muted-foreground"> · {l.numero || l.objeto || "Sin número"}</span>
                  </span>
                  <span className={dias < 0 ? "text-destructive" : dias <= 1 ? "text-amber-600" : "text-muted-foreground"}>
                    {formatFechaHora(e.fecha)} ({textoDias(dias)})
                  </span>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative sm:w-72">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Número, objeto o dependencia"
                className="pl-8"
              />
            </div>
            <Select
              value={estado}
              onValueChange={(v) => setEstado((v as string) ?? "abiertas")}
              items={[
                { value: "abiertas", label: "En curso" },
                { value: "todas", label: "Todas" },
                ...ESTADOS_LICITACION.map((e) => ({ value: e, label: e })),
              ]}
            >
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="abiertas">En curso</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
                {ESTADOS_LICITACION.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {licitaciones === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : filtradas.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Gavel />
                </EmptyMedia>
                <EmptyTitle>{licitaciones.length ? "Sin resultados" : "Aún no hay licitaciones"}</EmptyTitle>
                <EmptyDescription>
                  {licitaciones.length
                    ? "Cambia el filtro o la búsqueda."
                    : "Crea una y sube la convocatoria: la IA arma la lista de requisitos, la tabla de puntos y las fechas."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedimiento</TableHead>
                    <TableHead>Dependencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Requisitos</TableHead>
                    <TableHead>Próxima fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((l) => {
                    const a = avance.get(l.id)
                    const prox = proximoDe(l.id)
                    return (
                      <TableRow key={l.id} className="cursor-pointer" onClick={() => router.push(`/licitaciones/${l.id}`)}>
                        <TableCell className="max-w-80">
                          <div className="flex flex-col">
                            <span className="font-medium">{l.numero || "Sin número"}</span>
                            <span className="line-clamp-2 text-xs text-muted-foreground">{l.objeto || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-56 text-sm">{l.dependencia || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={varianteEstado(l.estado)}>{l.estado}</Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {a && a.total ? `${a.listos} de ${a.total}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {prox ? (
                            <div className="flex flex-col">
                              <span>{prox.titulo || prox.tipo}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatFechaHora(prox.fecha)} ({textoDias(diasPara(prox.fecha))})
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {nuevaAbierta && (
        <NuevaLicitacionDialog
          onClose={() => setNuevaAbierta(false)}
          onCreada={(id) => router.push(`/licitaciones/${id}?tab=documentos`)}
        />
      )}
    </>
  )
}

function NuevaLicitacionDialog({ onClose, onCreada }: { onClose: () => void; onCreada: (id: string) => void }) {
  const [numero, setNumero] = React.useState("")
  const [objeto, setObjeto] = React.useState("")
  const [dependencia, setDependencia] = React.useState("")
  const [tipo, setTipo] = React.useState<TipoProcedimiento>("Licitación pública")
  const [guardando, setGuardando] = React.useState(false)

  async function crear() {
    setGuardando(true)
    const { data, error } = await createClient()
      .from("licitaciones")
      .insert({ numero: numero.trim(), objeto: objeto.trim(), dependencia: dependencia.trim(), tipo_procedimiento: tipo })
      .select("id")
      .single()
    setGuardando(false)
    if (error || !data) {
      toast.error(
        error?.message.includes("licitaciones_numero_unico")
          ? "Ya existe una licitación con ese número en esta empresa."
          : "No se pudo crear la licitación.",
      )
      return
    }
    onCreada(data.id)
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva licitación</DialogTitle>
          <DialogDescription>
            Captura lo que tengas a la mano; el resto lo llena la IA al leer la convocatoria en el siguiente paso.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="lic-numero">Número del procedimiento</FieldLabel>
            <Input id="lic-numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="LA-07-110-007000999-N-702-2026" />
            <FieldDescription>Opcional: se toma de la convocatoria.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="lic-objeto">Objeto</FieldLabel>
            <Input id="lic-objeto" value={objeto} onChange={(e) => setObjeto(e.target.value)} placeholder="Mantenimiento a plantas de tratamiento…" />
          </Field>
          <Field>
            <FieldLabel htmlFor="lic-dependencia">Dependencia</FieldLabel>
            <Input id="lic-dependencia" value={dependencia} onChange={(e) => setDependencia(e.target.value)} placeholder="SEDENA, IMSS, PEMEX…" />
          </Field>
          <Field>
            <FieldLabel>Tipo de procedimiento</FieldLabel>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoProcedimiento)} items={TIPOS_PROCEDIMIENTO.map((t) => ({ value: t, label: t }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PROCEDIMIENTO.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={guardando}>
            {guardando ? "Creando…" : "Crear y subir documentos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

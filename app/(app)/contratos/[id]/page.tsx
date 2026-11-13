"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, ClipboardPlus, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { ContratoFormDialog } from "@/components/contratos/contrato-form-dialog"
import { PartidaFormDialog } from "@/components/contratos/partida-form-dialog"
import { ExpedienteContrato } from "@/components/contratos/expediente-contrato"
import { GarantiasContrato } from "@/components/contratos/garantias-contrato"
import { EstadoContratoBadge } from "@/components/contratos/estado-contrato-badge"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { EstadoOrdenBadge } from "@/components/status-badges"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import { formatFecha, hoyISO } from "@/lib/format"
import { puedeEliminarContratos, puedeGestionarContratos } from "@/lib/permisos"
import { resumenUbicacion } from "@/lib/ubicacion"
import {
  diasPara,
  formatoMoneda,
  mapContrato,
  mapDocumento,
  mapPartida,
  type Contrato,
  type ContratoDocumento,
  type ContratoPartida,
} from "@/lib/contratos"

export default function ContratoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { clientes, ordenes, usuarioActual, crearOrden } = useStore()
  const [contrato, setContrato] = React.useState<Contrato | null | undefined>(undefined)
  const [partidas, setPartidas] = React.useState<ContratoPartida[]>([])
  const [documentos, setDocumentos] = React.useState<ContratoDocumento[]>([])
  const [editarAbierto, setEditarAbierto] = React.useState(false)
  const [partidaDialogo, setPartidaDialogo] = React.useState<{ abierto: boolean; partida: ContratoPartida | null }>({ abierto: false, partida: null })
  const [partidaEliminar, setPartidaEliminar] = React.useState<ContratoPartida | null>(null)
  const [eliminarContrato, setEliminarContrato] = React.useState(false)
  const [creandoOrden, setCreandoOrden] = React.useState<string | null>(null)

  const puedeGestionar = puedeGestionarContratos(usuarioActual.rol)
  const puedeEliminar = puedeEliminarContratos(usuarioActual.rol)

  React.useEffect(() => {
    let vigente = true
    const supabase = createClient()
    Promise.all([
      supabase.from("contratos").select("*").eq("id", id).maybeSingle(),
      supabase.from("contrato_partidas").select("*").eq("contrato_id", id).order("numero"),
      supabase.from("contrato_documentos").select("*").eq("contrato_id", id).order("created_at", { ascending: false }),
    ]).then(([c, p, d]) => {
      if (!vigente) return
      setContrato(c.data ? mapContrato(c.data) : null)
      setPartidas((p.data ?? []).map(mapPartida))
      setDocumentos((d.data ?? []).map(mapDocumento))
    })
    return () => {
      vigente = false
    }
  }, [id])

  if (contrato === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (contrato === null) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Contrato no encontrado</EmptyTitle>
          <EmptyDescription>No existe o pertenece a otra empresa.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" render={<Link href="/contratos" />} nativeButton={false}>Volver a contratos</Button>
      </Empty>
    )
  }

  const cliente = clientes.find((c) => c.id === contrato.clienteId)
  const ordenesContrato = ordenes.filter((o) => o.contratoId === contrato.id)
  const siguienteNumero = partidas.reduce((m, p) => Math.max(m, p.numero), 0) + 1
  const sumaPartidas = partidas.reduce((s, p) => s + p.importe, 0)
  const diasEntrega = diasPara(contrato.fechaLimiteEntrega)

  async function crearOrdenDePartida(p: ContratoPartida) {
    if (!contrato) return
    setCreandoOrden(p.id)
    const descripcion = [`Partida ${p.numero}: ${p.descripcion}`, p.alcance].filter(Boolean).join("\n\n")
    const nueva = await crearOrden({
      clienteId: contrato.clienteId,
      equipoId: "",
      contratoId: contrato.id,
      contratoPartidaId: p.id,
      fechaSolicitud: hoyISO(),
      fechaProgramada: null,
      horaProgramada: null,
      fechaInicio: null,
      fechaCierre: null,
      tipoServicio: "Preventivo",
      prioridad: "Normal",
      estado: "Pendiente de asignación",
      descripcionFalla: descripcion,
      diagnostico: "",
      trabajoRealizado: "",
      tecnicoId: null,
      materiales: "",
      materialesDetalle: [],
      evidencias: [],
      horasTrabajadas: null,
      observaciones: "",
      firmaCliente: "",
      firmaFecha: null,
      cerradaPor: null,
      creadoPor: usuarioActual.id,
      ticketId: null,
      historial: [],
    })
    setCreandoOrden(null)
    if (nueva) {
      toast.success(`Orden ${nueva.folio} creada desde la partida ${p.numero}.`)
      router.push(`/ordenes/${nueva.id}`)
    }
  }

  async function borrarPartida(p: ContratoPartida): Promise<boolean> {
    const { error } = await createClient().from("contrato_partidas").delete().eq("id", p.id)
    if (error) {
      toast.error(error.code === "23503" ? "La partida tiene órdenes ligadas; no se puede eliminar." : "No se pudo eliminar la partida.")
      return false
    }
    setPartidas((prev) => prev.filter((x) => x.id !== p.id))
    toast.success("Partida eliminada.")
    return true
  }

  async function borrarContrato(): Promise<boolean> {
    if (!contrato) return false
    const { error } = await createClient().from("contratos").delete().eq("id", contrato.id)
    if (error) {
      toast.error(error.code === "23503" ? "Primero depura el expediente y las órdenes ligadas." : "No se pudo eliminar el contrato.")
      return false
    }
    toast.success("Contrato eliminado.")
    router.push("/contratos")
    return true
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/contratos" />} nativeButton={false} aria-label="Volver">
          <ArrowLeft />
        </Button>
        <PageHeader
          title={contrato.numeroContrato}
          description={cliente?.nombre}
          actions={
            <div className="flex flex-wrap gap-2">
              {puedeGestionar && (
                <Button variant="outline" onClick={() => setEditarAbierto(true)}>
                  <Pencil data-icon="inline-start" />
                  Editar
                </Button>
              )}
              {puedeEliminar && (
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setEliminarContrato(true)}>
                  <Trash2 data-icon="inline-start" />
                  Eliminar
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <EstadoContratoBadge estado={contrato.estado} />
        <Badge variant="outline">{contrato.procedimiento}</Badge>
        {diasEntrega !== null && contrato.estado !== "Finiquitado" && contrato.estado !== "Cancelado" && (
          <Badge variant={diasEntrega < 0 ? "destructive" : diasEntrega <= 15 ? "outline" : "secondary"}>
            {diasEntrega < 0 ? `Entrega vencida hace ${-diasEntrega} días` : `Faltan ${diasEntrega} días para la fecha límite`}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Datos del contrato</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato label="Objeto" className="sm:col-span-2">{contrato.objeto || "—"}</Dato>
            <Dato label="Área requirente">{contrato.areaRequirente || "—"}</Dato>
            <Dato label="Procedimiento">{contrato.procedimiento} · {contrato.caracter}{contrato.electronico ? " · Electrónico" : ""}</Dato>
            <Dato label="Fecha de firma">{formatFecha(contrato.fechaFirma)}</Dato>
            <Dato label="Fecha límite de entrega">{formatFecha(contrato.fechaLimiteEntrega)}</Dato>
            <Dato label="Vigencia">{formatFecha(contrato.vigenciaInicio)} – {formatFecha(contrato.vigenciaFin)}</Dato>
            <Dato label="Suficiencia presupuestal">{contrato.suficienciaPresupuestal || "—"}</Dato>
            <Dato label="Administrador del contrato" className="sm:col-span-2">
              {contrato.administradorNombre || "—"}
              {contrato.administradorCargo ? <span className="block text-xs text-muted-foreground">{contrato.administradorCargo}</span> : null}
            </Dato>
            <Dato label="Lugar de ejecución" className="sm:col-span-2">{contrato.lugarEjecucion || "—"}</Dato>
            <Dato label="Contacto del área">{[contrato.contactoTelefono, contrato.contactoEmail].filter(Boolean).join(" · ") || "—"}</Dato>
            {contrato.notas ? <Dato label="Notas">{contrato.notas}</Dato> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Montos y garantías</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Fila label="Subtotal" valor={formatoMoneda(contrato.subtotal, contrato.moneda)} />
            <Fila label="IVA" valor={formatoMoneda(contrato.iva, contrato.moneda)} />
            <Fila label="Total" valor={formatoMoneda(contrato.total, contrato.moneda)} fuerte />
            <hr />
            <Fila label="Anticipo" valor={`${contrato.anticipoPct}%`} />
            <Fila label="Plazo de pago" valor={contrato.plazoPagoDiasHabiles != null ? `${contrato.plazoPagoDiasHabiles} días hábiles` : "—"} />
            <Fila
              label="Garantía de cumplimiento"
              valor={contrato.garantiaCumplimientoPct != null ? `${contrato.garantiaCumplimientoPct}% · ${formatoMoneda((contrato.subtotal * contrato.garantiaCumplimientoPct) / 100, contrato.moneda)}` : "—"}
            />
            <Fila label="Garantía de calidad" valor={contrato.garantiaCalidadMeses != null ? `${contrato.garantiaCalidadMeses} meses` : "—"} />
            <Fila
              label="Penas convencionales"
              valor={contrato.penaDiariaPct != null ? `${contrato.penaDiariaPct}% diario${contrato.penaMaximaPct != null ? `, máx. ${contrato.penaMaximaPct}%` : ""}` : "—"}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle>Partidas</CardTitle>
            <CardDescription>
              {partidas.length} partida(s) · suma {formatoMoneda(sumaPartidas, contrato.moneda)}
              {partidas.length > 0 && Math.abs(sumaPartidas - contrato.subtotal) > 0.5
                ? ` · no coincide con el subtotal (${formatoMoneda(contrato.subtotal, contrato.moneda)})`
                : ""}
            </CardDescription>
          </div>
          {puedeGestionar && (
            <Button variant="outline" onClick={() => setPartidaDialogo({ abierto: true, partida: null })}>
              <Plus data-icon="inline-start" />
              Agregar partida
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {partidas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin partidas. Agrega lo que especifica el contrato y su anexo técnico.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">No.</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="hidden md:table-cell">Equipos</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partidas.map((p) => {
                    const unidades = p.equipos.reduce((s, e) => s + e.cantidad, 0)
                    const nOrdenes = ordenesContrato.filter((o) => o.contratoPartidaId === p.id).length
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.numero}</TableCell>
                        <TableCell className="max-w-[28rem]">
                          <div className="font-medium">{p.descripcion}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.cantidad} {p.unidad}
                            {resumenUbicacion(p) ? ` · ${resumenUbicacion(p)}` : ""}
                            {nOrdenes ? ` · ${nOrdenes} orden(es)` : ""}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">
                          {p.equipos.length === 0 ? "—" : `${unidades} equipo(s)`}
                          {p.equipos.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {[...new Set(p.equipos.map((e) => [e.descripcion, e.marca].filter(Boolean).join(" ")))].join(", ")}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{formatoMoneda(p.importe, contrato.moneda)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {puedeGestionar && (
                              <>
                                <Button variant="outline" size="sm" onClick={() => crearOrdenDePartida(p)} disabled={creandoOrden !== null}>
                                  <ClipboardPlus data-icon="inline-start" />
                                  Crear orden
                                </Button>
                                <Button variant="ghost" size="icon-sm" aria-label={`Editar partida ${p.numero}`} onClick={() => setPartidaDialogo({ abierto: true, partida: p })}>
                                  <Pencil />
                                </Button>
                              </>
                            )}
                            {puedeEliminar && (
                              <Button variant="ghost" size="icon-sm" aria-label={`Eliminar partida ${p.numero}`} className="text-muted-foreground hover:text-destructive" onClick={() => setPartidaEliminar(p)}>
                                <Trash2 />
                              </Button>
                            )}
                          </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de servicio del contrato</CardTitle>
          <CardDescription>Órdenes con procedencia “Contrato” ligadas a este instrumento.</CardDescription>
        </CardHeader>
        <CardContent>
          {ordenesContrato.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay órdenes. Usa “Crear orden” en una partida.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {ordenesContrato.map((o) => {
                const partida = partidas.find((p) => p.id === o.contratoPartidaId)
                return (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div className="flex flex-col">
                      <Link href={`/ordenes/${o.id}`} className="font-mono text-sm font-medium text-primary hover:underline">{o.folio}</Link>
                      <span className="text-xs text-muted-foreground">
                        {partida ? `Partida ${partida.numero}` : "Sin partida"}
                        {resumenUbicacion(o) ? ` · ${resumenUbicacion(o)}` : ""}
                      </span>
                    </div>
                    <EstadoOrdenBadge estado={o.estado} />
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garantías y fianzas</CardTitle>
          <CardDescription>Seguimiento de cada garantía: entrega, póliza y liberación.</CardDescription>
        </CardHeader>
        <CardContent>
          <GarantiasContrato contratoId={contrato.id} documentos={documentos} puedeEditar={puedeGestionar} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expediente digital</CardTitle>
          <CardDescription>Archivos privados de este contrato; solo los ve el personal de {cliente ? "la empresa" : "esta empresa"} con acceso a contratos.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpedienteContrato
            contratoId={contrato.id}
            empresaId={contrato.empresaId}
            documentos={documentos}
            onCambio={setDocumentos}
            puedeSubir={puedeGestionar}
            puedeEliminar={puedeEliminar}
          />
        </CardContent>
      </Card>

      {puedeGestionar && (
        <>
          <ContratoFormDialog open={editarAbierto} onOpenChange={setEditarAbierto} contrato={contrato} onGuardado={setContrato} />
          <PartidaFormDialog
            open={partidaDialogo.abierto}
            onOpenChange={(abierto) => setPartidaDialogo((prev) => ({ ...prev, abierto }))}
            contratoId={contrato.id}
            partida={partidaDialogo.partida}
            siguienteNumero={siguienteNumero}
            esGobierno={cliente?.tipo === "Gobierno"}
            onGuardada={(p) =>
              setPartidas((prev) =>
                [...prev.filter((x) => x.id !== p.id), p].sort((a, b) => a.numero - b.numero),
              )
            }
          />
        </>
      )}

      <ConfirmDeleteDialog
        open={partidaEliminar !== null}
        onOpenChange={(o) => !o && setPartidaEliminar(null)}
        title="¿Eliminar partida?"
        description={<>Se eliminará la partida <strong>{partidaEliminar?.numero}</strong>. No se puede si ya tiene órdenes.</>}
        onConfirm={async () => (partidaEliminar ? borrarPartida(partidaEliminar) : false)}
      />
      <ConfirmDeleteDialog
        open={eliminarContrato}
        onOpenChange={setEliminarContrato}
        title="¿Eliminar contrato?"
        description={<>Se eliminará <strong>{contrato.numeroContrato}</strong> con sus partidas. Solo es posible si su expediente está vacío y no tiene órdenes.</>}
        onConfirm={borrarContrato}
      />
    </>
  )
}

function Dato({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-sm whitespace-pre-wrap">{children}</div>
    </div>
  )
}

function Fila({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right tabular-nums ${fuerte ? "font-semibold" : ""}`}>{valor}</span>
    </div>
  )
}

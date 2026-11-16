"use client"

import * as React from "react"
import { Download, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { formatFecha } from "@/lib/format"
import { BUCKET_EXPEDIENTES, diasPara, formatoMoneda, type ContratoDocumento } from "@/lib/contratos"
import { ESTADOS_GARANTIA, type EstadoGarantia } from "@/lib/importacion-contratos"

interface Garantia {
  id: string
  tipo: string
  forma: string
  requerida: boolean
  porcentaje: number | null
  monto: number | null
  moneda: string
  afianzadora: string
  numeroPoliza: string
  folio: string
  lineaValidacion: string
  fechaExpedicion: string | null
  fechaLimiteEntrega: string | null
  fechaEntrega: string | null
  vigenciaHasta: string | null
  estado: EstadoGarantia
  documentoPolizaId: string | null
}

function mapGarantia(r: Record<string, any>): Garantia {
  const n = (v: unknown) => (v == null ? null : Number(v))
  const f = (v: unknown) => (v ? String(v).slice(0, 10) : null)
  return {
    id: r.id,
    tipo: r.tipo ?? "",
    forma: r.forma ?? "",
    requerida: r.requerida !== false,
    porcentaje: n(r.porcentaje),
    monto: n(r.monto),
    moneda: r.moneda ?? "MXN",
    afianzadora: r.afianzadora ?? "",
    numeroPoliza: r.numero_poliza ?? "",
    folio: r.folio ?? "",
    lineaValidacion: r.linea_validacion ?? "",
    fechaExpedicion: f(r.fecha_expedicion),
    fechaLimiteEntrega: f(r.fecha_limite_entrega),
    fechaEntrega: f(r.fecha_entrega),
    vigenciaHasta: f(r.vigencia_hasta),
    estado: (r.estado ?? "Por tramitar") as EstadoGarantia,
    documentoPolizaId: r.documento_poliza_id ?? null,
  }
}

const PENDIENTES: EstadoGarantia[] = ["Por tramitar", "Solicitada", "Emitida"]

// Garantías (fianzas) del contrato con su seguimiento de estado.
export function GarantiasContrato({
  contratoId,
  documentos,
  puedeEditar,
}: {
  contratoId: string
  documentos: ContratoDocumento[]
  puedeEditar: boolean
}) {
  const [garantias, setGarantias] = React.useState<Garantia[] | null>(null)

  React.useEffect(() => {
    let vigente = true
    createClient()
      .from("contrato_garantias")
      .select("*")
      .eq("contrato_id", contratoId)
      .order("created_at")
      .then(({ data }) => {
        if (vigente) setGarantias((data ?? []).map(mapGarantia))
      })
    return () => {
      vigente = false
    }
  }, [contratoId])

  async function cambiarEstado(g: Garantia, estado: EstadoGarantia) {
    const cambios: Record<string, unknown> = { estado }
    if (estado === "Entregada" && !g.fechaEntrega) cambios.fecha_entrega = new Date().toISOString().slice(0, 10)
    if (estado === "Exceptuada") cambios.requerida = false
    const { data, error } = await createClient()
      .from("contrato_garantias")
      .update(cambios)
      .eq("id", g.id)
      .select("*")
      .single()
    if (error || !data) {
      toast.error("No se pudo actualizar la garantía.")
      return
    }
    setGarantias((prev) => (prev ?? []).map((x) => (x.id === g.id ? mapGarantia(data) : x)))
    toast.success(`Garantía marcada como “${estado}”.`)
  }

  async function abrirPoliza(documentoId: string) {
    const doc = documentos.find((d) => d.id === documentoId)
    if (!doc) return
    const { data } = await createClient()
      .storage.from(BUCKET_EXPEDIENTES)
      .createSignedUrl(doc.storagePath, 120, { download: doc.nombreArchivo })
    if (data) window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    else toast.error("No se pudo abrir la póliza.")
  }

  if (garantias === null) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (garantias.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin garantías registradas. Se registran solas al dar de alta el contrato desde documentos.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {garantias.map((g) => {
        const dias = diasPara(g.fechaLimiteEntrega)
        const atrasada = dias !== null && dias < 0 && PENDIENTES.includes(g.estado)
        return (
          <li key={g.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
            <ShieldCheck className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Garantía de {g.tipo.toLowerCase()}</span>
                <Badge variant="outline">{g.forma}</Badge>
                {atrasada && <Badge variant="destructive">Entrega vencida</Badge>}
                {!atrasada && dias !== null && dias <= 5 && PENDIENTES.includes(g.estado) && (
                  <Badge variant="outline">Entregar en {dias} día(s)</Badge>
                )}
              </div>
              <span className="text-muted-foreground">
                {g.porcentaje != null ? `${g.porcentaje}% · ` : ""}
                {g.monto != null ? formatoMoneda(g.monto, g.moneda) : "Monto sin capturar"}
                {g.fechaLimiteEntrega ? ` · entregar a más tardar ${formatFecha(g.fechaLimiteEntrega)}` : ""}
              </span>
              {(g.afianzadora || g.numeroPoliza) && (
                <span>
                  {g.afianzadora || "Afianzadora"} · póliza <span className="font-mono">{g.numeroPoliza || "—"}</span>
                  {g.folio ? <> · folio <span className="font-mono">{g.folio}</span></> : null}
                  {g.fechaExpedicion ? ` · expedida ${formatFecha(g.fechaExpedicion)}` : ""}
                </span>
              )}
              {g.lineaValidacion && (
                <span className="text-xs text-muted-foreground">
                  Línea de validación: <span className="font-mono">{g.lineaValidacion}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {g.documentoPolizaId && (
                <Button variant="outline" size="sm" onClick={() => abrirPoliza(g.documentoPolizaId!)}>
                  <Download data-icon="inline-start" />
                  Póliza
                </Button>
              )}
              {puedeEditar ? (
                <Select value={g.estado} onValueChange={(v) => cambiarEstado(g, v as EstadoGarantia)}>
                  <SelectTrigger className="w-40" aria-label="Estado de la garantía"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_GARANTIA.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{g.estado}</Badge>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

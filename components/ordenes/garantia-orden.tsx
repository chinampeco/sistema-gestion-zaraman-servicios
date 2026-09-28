"use client"

import * as React from "react"
import { ShieldCheck, Plus, ReceiptText, Wrench } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { hoyISO, formatFecha } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import type { OrdenServicio } from "@/lib/types"

interface GarantiaRow {
  id: string
  orden_id: string
  orden_origen_id: string | null
  tiene_garantia: boolean
  duracion_valor: number | null
  duracion_unidad: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  cobertura: string | null
  condiciones: string | null
  resultado: string
  gastos: GastoGarantia[]
}

interface GastoGarantia {
  id: string
  concepto: string
  categoria: "Material" | "Traslado" | "Mano de obra" | "Otro"
  cantidad: number
  costoUnitario: number
  total: number
  fecha: string
  observaciones: string
}

function calcularVigencia(row: GarantiaRow | null) {
  if (!row?.tiene_garantia || !row.fecha_fin) return "Sin garantía"
  const hoy = new Date(`${hoyISO()}T00:00:00`)
  const fin = new Date(`${row.fecha_fin}T00:00:00`)
  return fin >= hoy ? "Vigente" : "Vencida"
}

function gastoTotal(gastos: GastoGarantia[]) {
  return gastos.reduce((sum, gasto) => sum + Number(gasto.total || 0), 0)
}

export function GarantiaOrden({ orden }: { orden: OrdenServicio }) {
  const supabase = React.useMemo(() => createClient(), [])
  const { crearOrden, usuarioActual } = useStore()
  const [garantia, setGarantia] = React.useState<GarantiaRow | null>(null)
  const [cargando, setCargando] = React.useState(true)
  const [atencionOpen, setAtencionOpen] = React.useState(false)
  const [motivo, setMotivo] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)

  const cargar = React.useCallback(async () => {
    setCargando(true)
    const { data, error } = await supabase
      .from("orden_garantias")
      .select("*")
      .eq("orden_id", orden.id)
      .maybeSingle()

    if (error) {
      // Mientras la migración aún no se haya aplicado, no bloqueamos la pantalla.
      console.warn("No se pudo cargar la garantía de la orden:", error.message)
      setGarantia(null)
    } else if (data) {
      setGarantia({ ...data, gastos: Array.isArray(data.gastos) ? data.gastos : [] })
    } else {
      setGarantia(null)
    }
    setCargando(false)
  }, [orden.id, supabase])

  React.useEffect(() => {
    void cargar()
  }, [cargar])

  const estado = calcularVigencia(garantia)
  const esAtencionGarantia = Boolean(garantia?.orden_origen_id)
  const puedeGenerarAtencion =
    !esAtencionGarantia &&
    Boolean(garantia?.tiene_garantia) &&
    estado === "Vigente" &&
    orden.estado === "Terminada"

  const crearAtencionGarantia = async () => {
    if (!garantia || !motivo.trim()) {
      toast.error("Describe el motivo de la atención de garantía.")
      return
    }

    setGuardando(true)
    try {
      const nueva = await crearOrden({
        clienteId: orden.clienteId,
        equipoId: orden.equipoId,
        fechaSolicitud: hoyISO(),
        fechaProgramada: null,
        horaProgramada: null,
        fechaInicio: null,
        fechaCierre: null,
        tipoServicio: "Correctivo",
        prioridad: "Normal",
        estado: "Pendiente",
        descripcionFalla: `ATENCIÓN POR GARANTÍA de ${orden.folio}: ${motivo.trim()}`,
        diagnostico: "",
        trabajoRealizado: "",
        tecnicoId: null,
        materiales: "",
        materialesDetalle: [],
        evidencias: [],
        horasTrabajadas: null,
        observaciones: `Orden original: ${orden.folio}. Atención generada sin modificar la orden original.`,
        firmaCliente: "",
        firmaFecha: null,
        cerradaPor: null,
        creadoPor: usuarioActual.id,
        ticketId: null,
        historial: [],
      })

      if (!nueva) return

      const { error } = await supabase.from("orden_garantias").upsert(
        {
          orden_id: nueva.id,
          orden_origen_id: orden.id,
          tiene_garantia: true,
          duracion_valor: garantia.duracion_valor,
          duracion_unidad: garantia.duracion_unidad,
          fecha_inicio: garantia.fecha_inicio,
          fecha_fin: garantia.fecha_fin,
          cobertura: garantia.cobertura,
          condiciones: garantia.condiciones,
          resultado: "Aprobada",
          gastos: [],
        },
        { onConflict: "orden_id" },
      )

      if (error) {
        toast.error("La orden se creó, pero no se pudo enlazar la garantía.")
        return
      }

      toast.success(`${nueva.folio} creada como atención de garantía.`)
      setAtencionOpen(false)
      setMotivo("")
      await cargar()
    } finally {
      setGuardando(false)
    }
  }

  const totalGastos = gastoTotal(garantia?.gastos ?? [])

  if (cargando) {
    return <div className="text-sm text-muted-foreground">Cargando garantía…</div>
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Garantía
          </CardTitle>
          <Badge variant={estado === "Vigente" ? "default" : estado === "Vencida" ? "destructive" : "outline"}>
            {esAtencionGarantia ? "Atención de garantía" : estado}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {garantia?.tiene_garantia ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Dato label="Vigencia">{garantia.duracion_valor} {garantia.duracion_unidad}</Dato>
              <Dato label="Inicio">{formatFecha(garantia.fecha_inicio)}</Dato>
              <Dato label="Vencimiento">{formatFecha(garantia.fecha_fin)}</Dato>
              <Dato label="Cobertura">{garantia.cobertura || "No especificada"}</Dato>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta orden no tiene garantía registrada.</p>
          )}

          {garantia?.condiciones ? (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Condiciones</div>
              <p className="whitespace-pre-wrap">{garantia.condiciones}</p>
            </div>
          ) : null}

          {esAtencionGarantia && garantia?.orden_origen_id ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              Esta orden fue generada como atención de garantía de la orden original. La orden original permanece intacta.
            </div>
          ) : null}

          {garantia?.tiene_garantia && (
            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ReceiptText className="size-4" />
                  Costos internos de garantía
                </div>
                <p className="text-xs text-muted-foreground">
                  Materiales, traslado, mano de obra y otros gastos. No implican cobro al cliente.
                </p>
              </div>
              <span className="text-lg font-semibold">${totalGastos.toFixed(2)}</span>
            </div>
          )}

          {puedeGenerarAtencion ? (
            <Button onClick={() => setAtencionOpen(true)}>
              <Wrench data-icon="inline-start" />
              Nueva atención por garantía
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={atencionOpen} onOpenChange={setAtencionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva atención por garantía</DialogTitle>
            <DialogDescription>
              Se creará una nueva orden vinculada a {orden.folio}. La orden original no se modificará.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="motivo-garantia">Motivo reportado</FieldLabel>
              <Textarea
                id="motivo-garantia"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe la falla o motivo por el que el cliente solicita la garantía."
                rows={4}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtencionOpen(false)}>Cancelar</Button>
            <Button disabled={guardando || !motivo.trim()} onClick={crearAtencionGarantia}>
              {guardando ? "Creando…" : "Crear atención"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

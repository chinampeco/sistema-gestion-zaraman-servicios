"use client"

import * as React from "react"
import { Check, LockKeyhole, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStore } from "@/lib/store"
import { puedeReasignarOrdenes } from "@/lib/permisos"
import type { OrdenServicio } from "@/lib/types"

export function OrdenParteTecnico({ orden }: { orden: OrdenServicio }) {
  const { usuarioActual, actualizarOrden } = useStore()
  const [diagnostico, setDiagnostico] = React.useState(orden.diagnostico)
  const [trabajoRealizado, setTrabajoRealizado] = React.useState(orden.trabajoRealizado)
  const [observaciones, setObservaciones] = React.useState(orden.observaciones)
  const [horasTrabajadas, setHorasTrabajadas] = React.useState(
    orden.horasTrabajadas == null ? "" : String(orden.horasTrabajadas),
  )
  const [guardando, setGuardando] = React.useState(false)

  React.useEffect(() => {
    setDiagnostico(orden.diagnostico)
    setTrabajoRealizado(orden.trabajoRealizado)
    setObservaciones(orden.observaciones)
    setHorasTrabajadas(orden.horasTrabajadas == null ? "" : String(orden.horasTrabajadas))
  }, [
    orden.diagnostico,
    orden.trabajoRealizado,
    orden.observaciones,
    orden.horasTrabajadas,
  ])

  const bloqueada = Boolean(orden.firmaCliente)
  const esTecnicoAsignado =
    usuarioActual.rol === "Técnico" &&
    usuarioActual.tecnicoId != null &&
    usuarioActual.tecnicoId === orden.tecnicoId
  const puedeEditarComoSupervisor = puedeReasignarOrdenes(usuarioActual.rol)
  const puedeEditarParte = !bloqueada && (esTecnicoAsignado || puedeEditarComoSupervisor)

  const sucio =
    diagnostico !== orden.diagnostico ||
    trabajoRealizado !== orden.trabajoRealizado ||
    observaciones !== orden.observaciones ||
    horasTrabajadas !== (orden.horasTrabajadas == null ? "" : String(orden.horasTrabajadas))

  const guardar = async () => {
    if (!puedeEditarParte) {
      toast.error(
        bloqueada
          ? "La orden está bloqueada después de la firma del cliente."
          : "Solo el técnico asignado o un supervisor autorizado puede actualizar el parte técnico.",
      )
      return
    }

    const horas = horasTrabajadas.trim() === "" ? null : Number(horasTrabajadas)
    if (horas != null && (!Number.isFinite(horas) || horas < 0)) {
      toast.error("Las horas trabajadas deben ser un número válido mayor o igual a cero.")
      return
    }

    setGuardando(true)
    try {
      await actualizarOrden(orden.id, {
        diagnostico,
        trabajoRealizado,
        observaciones,
        horasTrabajadas: horas,
      })
      toast.success("Parte técnico actualizado.")
    } catch {
      toast.error("No se pudo guardar el parte técnico.")
    } finally {
      setGuardando(false)
    }
  }

  if (bloqueada) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <LockKeyhole className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Parte técnico bloqueado</p>
            <p className="mt-1 text-muted-foreground">
              El cliente ya firmó la conformidad. El diagnóstico, trabajo realizado,
              observaciones y horas ya no pueden modificarse.
            </p>
          </div>
        </div>
        <CamposSoloLectura
          diagnostico={orden.diagnostico}
          trabajoRealizado={orden.trabajoRealizado}
          observaciones={orden.observaciones}
          horasTrabajadas={orden.horasTrabajadas}
        />
      </div>
    )
  }

  if (!puedeEditarParte) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          El parte técnico se puede capturar por el técnico asignado durante la ejecución del servicio.
        </div>
        <CamposSoloLectura
          diagnostico={orden.diagnostico}
          trabajoRealizado={orden.trabajoRealizado}
          observaciones={orden.observaciones}
          horasTrabajadas={orden.horasTrabajadas}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
        <p className="font-medium">Captura del servicio en campo</p>
        <p className="mt-1 text-muted-foreground">
          Registra aquí lo encontrado y lo realizado durante el servicio. Estos datos quedarán
          bloqueados cuando el cliente firme la conformidad.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="diagnostico" className="text-sm font-medium">
            Diagnóstico
          </label>
          <Textarea
            id="diagnostico"
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="Describe la falla encontrada, causa probable, mediciones y diagnóstico."
            rows={5}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="trabajo-realizado" className="text-sm font-medium">
            Trabajo realizado
          </label>
          <Textarea
            id="trabajo-realizado"
            value={trabajoRealizado}
            onChange={(e) => setTrabajoRealizado(e.target.value)}
            placeholder="Describe las actividades realizadas, pruebas y resultados."
            rows={5}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="observaciones" className="text-sm font-medium">
            Observaciones
          </label>
          <Textarea
            id="observaciones"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones, recomendaciones o pendientes para el cliente."
            rows={4}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="horas-trabajadas" className="text-sm font-medium">
            Horas trabajadas
          </label>
          <Input
            id="horas-trabajadas"
            type="number"
            min={0}
            step="0.25"
            value={horasTrabajadas}
            onChange={(e) => setHorasTrabajadas(e.target.value)}
            placeholder="Ej. 2.5"
          />
          <p className="text-xs text-muted-foreground">
            Puedes registrar fracciones de hora, por ejemplo 2.5 h.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="button" onClick={guardar} disabled={!sucio || guardando}>
          {guardando ? <Save data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          {guardando ? "Guardando..." : "Guardar avances"}
        </Button>
      </div>
    </div>
  )
}

function CamposSoloLectura({
  diagnostico,
  trabajoRealizado,
  observaciones,
  horasTrabajadas,
}: {
  diagnostico: string
  trabajoRealizado: string
  observaciones: string
  horasTrabajadas: number | null
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Bloque label="Diagnóstico" value={diagnostico} />
      <Bloque label="Trabajo realizado" value={trabajoRealizado} />
      <Bloque label="Observaciones" value={observaciones} />
      <Bloque
        label="Horas trabajadas"
        value={horasTrabajadas == null ? "—" : `${horasTrabajadas} h`}
      />
    </div>
  )
}

function Bloque({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value || "—"}</p>
    </div>
  )
}

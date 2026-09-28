"use client"

import * as React from "react"
import { Eraser, Check, LockKeyhole } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"
import type { HistorialEvento, OrdenServicio } from "@/lib/types"

type FirmaTecnicoEvento = HistorialEvento & {
  tipo?: string
  firmaTecnico?: string
  firmaTecnicoFecha?: string
  tecnicoId?: string | null
}

function obtenerFirmaTecnico(orden: OrdenServicio): FirmaTecnicoEvento | null {
  const eventos = (orden.historial ?? []) as FirmaTecnicoEvento[]
  return [...eventos].reverse().find((evento) => evento.tipo === "Firma técnico" && evento.firmaTecnico) ?? null
}

export function OrdenFirma({ orden }: { orden: OrdenServicio }) {
  const { usuarioActual, actualizarOrden } = useStore()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const dibujando = React.useRef(false)
  const [tieneTrazo, setTieneTrazo] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)

  const firmaTecnico = obtenerFirmaTecnico(orden)
  const esTecnicoAsignado =
    usuarioActual.rol === "Técnico" &&
    usuarioActual.tecnicoId != null &&
    usuarioActual.tecnicoId === orden.tecnicoId

  const posicion = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = posicion(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    dibujando.current = true
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const ctx = canvasRef.current!.getContext("2d")!
    const { x, y } = posicion(e)
    ctx.lineTo(x, y)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.strokeStyle = "#0f172a"
    ctx.stroke()
    setTieneTrazo(true)
  }

  const end = () => {
    dibujando.current = false
  }

  const limpiar = () => {
    const canvas = canvasRef.current!
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
    setTieneTrazo(false)
  }

  const guardarFirmaCliente = async () => {
    if (!tieneTrazo) {
      toast.error("Captura la firma antes de guardar.")
      return
    }
    setGuardando(true)
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png")
      await actualizarOrden(orden.id, {
        firmaCliente: dataUrl,
        firmaFecha: new Date().toISOString(),
      })
      toast.success("Firma de conformidad guardada. La orden queda bloqueada y queda pendiente la firma del técnico.")
    } catch {
      toast.error("No se pudo guardar la firma.")
    } finally {
      setGuardando(false)
    }
  }

  const guardarFirmaTecnico = async () => {
    if (!orden.firmaCliente?.trim()) {
      toast.error("No se puede cerrar la orden: primero debe quedar registrada la firma del cliente.")
      return
    }
    if (!tieneTrazo) {
      toast.error("Captura la firma del técnico antes de guardar.")
      return
    }
    if (!esTecnicoAsignado) {
      toast.error("Solo el técnico asignado puede firmar el cierre de la orden.")
      return
    }

    setGuardando(true)
    try {
      const dataUrl = canvasRef.current!.toDataURL("image/png")
      const ahora = new Date().toISOString()
      const evento: FirmaTecnicoEvento = {
        estado: "Terminada",
        fecha: ahora,
        usuarioId: usuarioActual.id,
        usuarioNombre: usuarioActual.nombre,
        tipo: "Firma técnico",
        firmaTecnico: dataUrl,
        firmaTecnicoFecha: ahora,
        tecnicoId: orden.tecnicoId,
      }

      // El trigger de Supabase activa la garantía automáticamente al pasar a Terminada.
      // El técnico no necesita permiso de escritura sobre orden_garantias.
      await actualizarOrden(orden.id, {
        historial: [...(orden.historial ?? []), evento as HistorialEvento],
        estado: "Terminada",
        fechaCierre: ahora,
        cerradaPor: usuarioActual.id,
      })

      limpiar()
      toast.success("Firma del técnico guardada. La orden quedó terminada y, si corresponde, la garantía inició en la fecha de cierre.")
    } catch {
      toast.error("No se pudo guardar la firma del técnico.")
    } finally {
      setGuardando(false)
    }
  }

  if (!orden.firmaCliente?.trim()) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          El cliente aún no ha firmado la conformidad del servicio. La orden no puede cerrarse hasta registrar una firma válida.
        </p>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none rounded-lg border border-dashed border-border bg-card"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
            <Eraser data-icon="inline-start" />
            Limpiar
          </Button>
          <Button type="button" size="sm" onClick={guardarFirmaCliente} disabled={guardando}>
            <Check data-icon="inline-start" />
            {guardando ? "Guardando..." : "Guardar firma del cliente"}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LockKeyhole className="size-4" />
          Orden bloqueada después de la firma del cliente
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ya no se pueden modificar la orden, materiales, evidencias ni la firma del cliente.
          El único paso pendiente es la firma del técnico asignado para cerrar el servicio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={orden.firmaCliente || "/placeholder.svg"}
            alt="Firma del cliente"
            className="mx-auto h-32 w-auto"
          />
          <div className="mt-2 text-center text-sm font-medium">Firma del cliente</div>
          <div className="text-center text-xs text-muted-foreground">
            Firmada el {formatFecha(orden.firmaFecha)}
          </div>
        </div>

        {firmaTecnico ? (
          <div className="rounded-lg border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firmaTecnico.firmaTecnico || "/placeholder.svg"}
              alt="Firma del técnico"
              className="mx-auto h-32 w-auto"
            />
            <div className="mt-2 text-center text-sm font-medium">Firma del técnico</div>
            <div className="text-center text-xs text-muted-foreground">
              {firmaTecnico.usuarioNombre}
              {firmaTecnico.firmaTecnicoFecha
                ? ` · ${formatFecha(firmaTecnico.firmaTecnicoFecha)}`
                : ""}
            </div>
          </div>
        ) : null}
      </div>

      {!firmaTecnico ? (
        esTecnicoAsignado ? (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-primary/40 p-3">
            <div>
              <p className="text-sm font-medium">Firma del técnico para cerrar la orden</p>
              <p className="text-xs text-muted-foreground">
                Al guardar esta firma, la orden pasará automáticamente a “Terminada”, se registrará la fecha de cierre y se activará la garantía si fue configurada.
              </p>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full touch-none rounded-lg border border-dashed border-border bg-card"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
            />
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={limpiar}>
                <Eraser data-icon="inline-start" />
                Limpiar
              </Button>
              <Button type="button" size="sm" onClick={guardarFirmaTecnico} disabled={guardando || !orden.firmaCliente?.trim()}>
                <Check data-icon="inline-start" />
                {guardando ? "Cerrando..." : "Firmar y cerrar orden"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pendiente de la firma del técnico asignado para concluir el servicio.
          </p>
        )
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          Servicio concluido. La orden está cerrada y ya no admite modificaciones.
        </div>
      )}
    </div>
  )
}

export function getFirmaTecnico(orden: OrdenServicio): FirmaTecnicoEvento | null {
  return obtenerFirmaTecnico(orden)
}

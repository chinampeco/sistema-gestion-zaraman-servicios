"use client"

import * as React from "react"
import { Eraser, Check, LockKeyhole } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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

/** Recuadro para firmar con el dedo o el mouse. */
interface PadFirma {
  vacio: () => boolean
  imagen: () => string
  limpiar: () => void
}

const PadDeFirma = React.forwardRef<PadFirma, { etiqueta: string }>(function PadDeFirma({ etiqueta }, ref) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const dibujando = React.useRef(false)
  const trazo = React.useRef(false)
  const [, refrescar] = React.useState(0)

  const posicion = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }
  const limpiar = () => {
    const canvas = canvasRef.current
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
    trazo.current = false
    refrescar((n) => n + 1)
  }
  React.useImperativeHandle(ref, () => ({
    vacio: () => !trazo.current,
    imagen: () => canvasRef.current!.toDataURL("image/png"),
    limpiar,
  }))

  return (
    <div className="flex flex-col gap-1">
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        aria-label={etiqueta}
        className="w-full touch-none rounded-lg border border-dashed border-border bg-card"
        onPointerDown={(e) => {
          e.preventDefault()
          const ctx = canvasRef.current!.getContext("2d")!
          const { x, y } = posicion(e)
          ctx.beginPath()
          ctx.moveTo(x, y)
          dibujando.current = true
        }}
        onPointerMove={(e) => {
          if (!dibujando.current) return
          const ctx = canvasRef.current!.getContext("2d")!
          const { x, y } = posicion(e)
          ctx.lineTo(x, y)
          ctx.lineWidth = 2
          ctx.lineCap = "round"
          ctx.strokeStyle = "#0f172a"
          ctx.stroke()
          trazo.current = true
        }}
        onPointerUp={() => (dibujando.current = false)}
        onPointerLeave={() => (dibujando.current = false)}
      />
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={limpiar}>
        <Eraser data-icon="inline-start" />
        Limpiar
      </Button>
    </div>
  )
})

/** Firmas de recepción: área usuaria (obligatoria) y área técnica (si el contrato la pide). */
function FirmasRecepcion({ orden }: { orden: OrdenServicio }) {
  const { actualizarOrden } = useStore()
  const usuaria = React.useRef<PadFirma>(null)
  const tecnica = React.useRef<PadFirma>(null)
  const [nombreUsuaria, setNombreUsuaria] = React.useState(orden.firmaClienteNombre ?? "")
  const [conTecnica, setConTecnica] = React.useState(!!orden.contratoId)
  const [nombreTecnica, setNombreTecnica] = React.useState(orden.firmaAreaTecnicaNombre ?? "")
  const [guardando, setGuardando] = React.useState(false)

  const guardar = async () => {
    if (!nombreUsuaria.trim()) return toast.error("Escribe el nombre y cargo de quien recibe por el área usuaria.")
    if (usuaria.current?.vacio()) return toast.error("Falta la firma del área usuaria.")
    if (conTecnica) {
      if (!nombreTecnica.trim()) return toast.error("Escribe el nombre y cargo de quien recibe por el área técnica.")
      if (tecnica.current?.vacio()) return toast.error("Falta la firma del área técnica.")
    }
    setGuardando(true)
    try {
      const ahora = new Date().toISOString()
      await actualizarOrden(orden.id, {
        firmaCliente: usuaria.current!.imagen(),
        firmaClienteNombre: nombreUsuaria.trim(),
        firmaFecha: ahora,
        ...(conTecnica
          ? {
              firmaAreaTecnica: tecnica.current!.imagen(),
              firmaAreaTecnicaNombre: nombreTecnica.trim(),
              firmaAreaTecnicaFecha: ahora,
            }
          : {}),
      })
      toast.success("Firmas de recepción guardadas. La orden queda bloqueada y falta la firma del técnico.")
    } catch {
      toast.error("No se pudieron guardar las firmas.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Al terminar el servicio, recaba las firmas de quien recibe. La orden no puede cerrarse sin la firma del área usuaria.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <span className="text-sm font-medium">Recibió por parte del área usuaria</span>
          <Input
            value={nombreUsuaria}
            onChange={(e) => setNombreUsuaria(e.target.value)}
            placeholder="Grado, nombre completo y cargo"
            aria-label="Nombre de quien recibe por el área usuaria"
          />
          <PadDeFirma ref={usuaria} etiqueta="Firma del área usuaria" />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={conTecnica} onCheckedChange={setConTecnica} />
            Recibió por parte del área técnica
          </label>
          {conTecnica ? (
            <>
              <Input
                value={nombreTecnica}
                onChange={(e) => setNombreTecnica(e.target.value)}
                placeholder="Grado, nombre completo y cargo"
                aria-label="Nombre de quien recibe por el área técnica"
              />
              <PadDeFirma ref={tecnica} etiqueta="Firma del área técnica" />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Actívalo si el contrato pide también la firma del área técnica.</p>
          )}
        </div>
      </div>
      <Button type="button" className="self-end" onClick={guardar} disabled={guardando}>
        <Check data-icon="inline-start" />
        {guardando ? "Guardando..." : "Guardar firmas de recepción"}
      </Button>
    </div>
  )
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
    return <FirmasRecepcion orden={orden} />
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
          <div className="mt-2 text-center text-sm font-medium">Área usuaria</div>
          <div className="text-center text-xs text-muted-foreground">
            {orden.firmaClienteNombre ? `${orden.firmaClienteNombre} · ` : ""}Firmada el {formatFecha(orden.firmaFecha)}
          </div>
        </div>

        {orden.firmaAreaTecnica ? (
          <div className="rounded-lg border border-border bg-card p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={orden.firmaAreaTecnica} alt="Firma del área técnica" className="mx-auto h-32 w-auto" />
            <div className="mt-2 text-center text-sm font-medium">Área técnica</div>
            <div className="text-center text-xs text-muted-foreground">
              {orden.firmaAreaTecnicaNombre}
              {orden.firmaAreaTecnicaFecha ? ` · ${formatFecha(orden.firmaAreaTecnicaFecha)}` : ""}
            </div>
          </div>
        ) : null}

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

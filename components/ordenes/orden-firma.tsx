"use client"

import * as React from "react"
import { Eraser, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"
import type { OrdenServicio } from "@/lib/types"

export function OrdenFirma({ orden }: { orden: OrdenServicio }) {
  const { actualizarOrden } = useStore()
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const dibujando = React.useRef(false)
  const [tieneTrazo, setTieneTrazo] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)

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

  const guardar = async () => {
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
      toast.success("Firma de conformidad guardada.")
    } catch {
      toast.error("No se pudo guardar la firma.")
    } finally {
      setGuardando(false)
    }
  }

  const borrarGuardada = async () => {
    await actualizarOrden(orden.id, { firmaCliente: "", firmaFecha: null })
    limpiar()
    toast.success("Firma eliminada.")
  }

  if (orden.firmaCliente) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={orden.firmaCliente || "/placeholder.svg"}
            alt="Firma del cliente"
            className="mx-auto h-32 w-auto"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Firmada el {formatFecha(orden.firmaFecha)}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={borrarGuardada}>
            <Eraser data-icon="inline-start" />
            Volver a firmar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
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
        <Button type="button" size="sm" onClick={guardar} disabled={guardando}>
          <Check data-icon="inline-start" />
          {guardando ? "Guardando..." : "Guardar firma"}
        </Button>
      </div>
    </div>
  )
}

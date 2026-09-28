"use client"

import * as React from "react"
import Link from "next/link"
import { Truck, Play, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useStore } from "@/lib/store"
import type { EstadoOrden, HistorialEvento, OrdenServicio } from "@/lib/types"

type AccionPendiente = "camino" | "iniciar" | null

/** Acciones rápidas para el técnico en la vista de campo. */
export function AccionesRapidasTecnico({ orden }: { orden: OrdenServicio }) {
  const { usuarioActual, actualizarOrden } = useStore()
  const [pendiente, setPendiente] = React.useState<AccionPendiente>(null)
  const [guardando, setGuardando] = React.useState(false)

  const esMiOrden =
    usuarioActual.rol === "Técnico" &&
    orden.tecnicoId != null &&
    orden.tecnicoId === usuarioActual.tecnicoId

  if (!esMiOrden) return null
  if (orden.estado === "Terminada" || orden.estado === "Cancelada") return null
  // Después de la firma del cliente el servicio entra en etapa de cierre:
  // el único paso disponible para el técnico es firmar y cerrar la orden.
  if (orden.firmaCliente) return null

  const enProceso = orden.estado === "En proceso"

  const registrar = async (
    nuevoEstado: EstadoOrden,
    extra: Partial<OrdenServicio> = {},
  ) => {
    const evento: HistorialEvento = {
      estado: nuevoEstado,
      fecha: new Date().toISOString(),
      usuarioId: usuarioActual.id,
      usuarioNombre: usuarioActual.nombre,
    }
    setGuardando(true)
    await actualizarOrden(orden.id, {
      estado: nuevoEstado,
      historial: [...(orden.historial ?? []), evento],
      ...extra,
    })
    setGuardando(false)
    setPendiente(null)
  }

  const confirmar = async () => {
    if (pendiente === "camino") {
      await registrar("En camino")
    } else if (pendiente === "iniciar") {
      await registrar("En proceso", { fechaInicio: new Date().toISOString() })
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 border-t pt-3">
        {enProceso ? (
          <Button className="w-full" render={<Link href={`/ordenes/${orden.id}`} />} nativeButton={false}>
            <ArrowRight data-icon="inline-start" />
            Continuar servicio
          </Button>
        ) : (
          <>
            {orden.estado !== "En camino" && (
              <Button variant="outline" className="w-full" onClick={() => setPendiente("camino")}>
                <Truck data-icon="inline-start" />
                En camino
              </Button>
            )}
            <Button className="w-full" onClick={() => setPendiente("iniciar")}>
              <Play data-icon="inline-start" />
              Iniciar servicio
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={pendiente !== null} onOpenChange={(open) => { if (!open && !guardando) setPendiente(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendiente === "camino" ? "¿Marcar en camino?" : "¿Iniciar servicio?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendiente === "camino"
                ? `Se registrará que vas en camino a la orden ${orden.folio}, con la fecha y hora actuales.`
                : `La orden ${orden.folio} pasará a "En proceso" y se registrará la hora de inicio.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmar() }} disabled={guardando}>
              {guardando ? "Guardando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

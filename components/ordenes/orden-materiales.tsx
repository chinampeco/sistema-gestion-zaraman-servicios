"use client"

import * as React from "react"
import { Plus, Trash2, LockKeyhole } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { puedeReasignarOrdenes } from "@/lib/permisos"
import { formatMoneda, hoyISO } from "@/lib/format"
import {
  UNIDADES_MATERIAL,
  type MaterialOrden,
  type OrdenServicio,
} from "@/lib/types"

function nuevoMaterial(tecnicoId: string | null): MaterialOrden {
  return {
    id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    descripcion: "",
    codigo: "",
    cantidad: 1,
    unidad: "Pieza",
    precio: 0,
    observaciones: "",
    tecnicoId,
    fecha: hoyISO(),
  }
}

export function OrdenMateriales({ orden }: { orden: OrdenServicio }) {
  const { actualizarOrden, tecnicos, usuarioActual } = useStore()
  const [items, setItems] = React.useState<MaterialOrden[]>(orden.materialesDetalle)
  const [guardando, setGuardando] = React.useState(false)
  const bloqueada = Boolean(orden.firmaCliente)
  const esTecnicoAsignado =
    usuarioActual.rol === "tecnico" &&
    usuarioActual.tecnicoId != null &&
    usuarioActual.tecnicoId === orden.tecnicoId
  const puedeEditar = !bloqueada && (esTecnicoAsignado || puedeReasignarOrdenes(usuarioActual.rol))

  React.useEffect(() => {
    setItems(orden.materialesDetalle)
  }, [orden.materialesDetalle])

  const total = items.reduce((sum, m) => sum + m.cantidad * m.precio, 0)
  const sucio = React.useMemo(
    () => JSON.stringify(items) !== JSON.stringify(orden.materialesDetalle),
    [items, orden.materialesDetalle],
  )

  const setItem = (id: string, patch: Partial<MaterialOrden>) =>
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const agregar = () => {
    if (!puedeEditar) return
    setItems((prev) => [...prev, nuevoMaterial(orden.tecnicoId)])
  }

  const eliminar = (id: string) => {
    if (!puedeEditar) return
    setItems((prev) => prev.filter((m) => m.id !== id))
  }

  const guardar = async () => {
    if (!puedeEditar) {
      toast.error(
        bloqueada
          ? "La orden está bloqueada después de la firma del cliente."
          : "Solo el técnico asignado o un usuario autorizado puede registrar materiales.",
      )
      return
    }
    setGuardando(true)
    try {
      await actualizarOrden(orden.id, { materialesDetalle: items })
      toast.success("Materiales actualizados.")
    } catch {
      toast.error("No se pudieron guardar los materiales.")
    } finally {
      setGuardando(false)
    }
  }

  const tecnicoNombre = (id: string | null) =>
    tecnicos.find((t) => t.id === id)?.nombre ?? "—"

  if (bloqueada || !puedeEditar) {
    return (
      <div className="flex flex-col gap-3">
        {bloqueada ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <LockKeyhole className="size-4" />
            Materiales y refacciones bloqueados después de la firma del cliente.
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Solo el técnico asignado y los responsables de operación pueden modificar materiales.
          </p>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay refacciones o materiales registrados.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((m) => (
              <div key={m.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-5">
                <div><span className="text-xs text-muted-foreground">Descripción</span><p className="text-sm">{m.descripcion || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Código / SKU</span><p className="text-sm">{m.codigo || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Cantidad</span><p className="text-sm">{m.cantidad} {m.unidad}</p></div>
                <div><span className="text-xs text-muted-foreground">Precio unitario</span><p className="text-sm">{formatMoneda(m.precio)}</p></div>
                <div><span className="text-xs text-muted-foreground">Registró</span><p className="text-sm">{tecnicoNombre(m.tecnicoId)}</p></div>
              </div>
            ))}
          </div>
        )}
        <div className="text-right text-sm text-muted-foreground">
          Total materiales: <span className="font-semibold text-foreground">{formatMoneda(total)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay refacciones o materiales registrados.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <div key={m.id} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="text-xs text-muted-foreground">Descripción</label>
                <Input value={m.descripcion} onChange={(e) => setItem(m.id, { descripcion: e.target.value })} placeholder="Refacción o material" />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-muted-foreground">Código / SKU</label>
                <Input value={m.codigo} onChange={(e) => setItem(m.id, { codigo: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Cantidad</label>
                <Input type="number" min={0} step="1" value={m.cantidad} onChange={(e) => setItem(m.id, { cantidad: Number(e.target.value) || 0 })} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Unidad</label>
                <Select value={m.unidad} onValueChange={(v) => setItem(m.id, { unidad: (v as string) || "Pieza" })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES_MATERIAL.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-muted-foreground">Precio unitario</label>
                <Input type="number" min={0} step="0.01" value={m.precio} onChange={(e) => setItem(m.id, { precio: Number(e.target.value) || 0 })} />
              </div>
              <div className="sm:col-span-5">
                <label className="text-xs text-muted-foreground">Observaciones</label>
                <Input value={m.observaciones} onChange={(e) => setItem(m.id, { observaciones: e.target.value })} placeholder="Opcional" />
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-4">
                <div>
                  <span className="text-xs text-muted-foreground">Importe</span>
                  <p className="text-sm font-medium tabular-nums">{formatMoneda(m.cantidad * m.precio)}</p>
                  <span className="text-xs text-muted-foreground">Registró: {tecnicoNombre(m.tecnicoId)}</span>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => eliminar(m.id)} aria-label="Eliminar material">
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus data-icon="inline-start" />
          Agregar material
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Total materiales: <span className="font-semibold text-foreground tabular-nums">{formatMoneda(total)}</span>
          </span>
          <Button type="button" size="sm" onClick={guardar} disabled={!sucio || guardando}>
            {guardando ? "Guardando..." : "Guardar materiales"}
          </Button>
        </div>
      </div>
    </div>
  )
}

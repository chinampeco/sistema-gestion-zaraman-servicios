"use client"

import * as React from "react"
import { Boxes, Edit3, History, PackagePlus, Search, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { formatMoneda } from "@/lib/format"
import { puedeEditar } from "@/lib/permisos"

interface Producto {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  categoria: string
  marca: string | null
  modelo: string | null
  unidad: string
  costo: number
  precio_venta: number
  stock: number
  stock_minimo: number
  ubicacion: string | null
  activo: boolean
}

interface Movimiento {
  id: string
  producto_id: string
  tipo: string
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  costo_unitario: number
  referencia: string | null
  orden_id: string | null
  notas: string | null
  created_at: string
}

const TIPOS_MOVIMIENTO = [
  "Entrada",
  "Salida",
  "Ajuste",
  "Devolución",
  "Consumo de servicio",
] as const

const UNIDADES = ["Pieza", "Metro", "Litro", "Kilogramo", "Caja", "Juego", "Servicio"]

type ProductoForm = {
  codigo: string
  nombre: string
  descripcion: string
  categoria: string
  marca: string
  modelo: string
  unidad: string
  costo: string
  precioVenta: string
  stockMinimo: string
  ubicacion: string
  activo: boolean
}

const emptyProducto = (): ProductoForm => ({
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "General",
  marca: "",
  modelo: "",
  unidad: "Pieza",
  costo: "0",
  precioVenta: "0",
  stockMinimo: "0",
  ubicacion: "",
  activo: true,
})

export default function InventarioPage() {
  const supabase = React.useMemo(() => createClient(), [])
  const { usuarioActual, ordenes } = useStore()
  const editable = puedeEditar(usuarioActual.rol)
  const [productos, setProductos] = React.useState<Producto[]>([])
  const [movimientos, setMovimientos] = React.useState<Movimiento[]>([])
  const [busqueda, setBusqueda] = React.useState("")
  const [soloBajoStock, setSoloBajoStock] = React.useState(false)
  const [cargando, setCargando] = React.useState(true)
  const [productoOpen, setProductoOpen] = React.useState(false)
  const [movimientoOpen, setMovimientoOpen] = React.useState(false)
  const [historialOpen, setHistorialOpen] = React.useState(false)
  const [productoEditando, setProductoEditando] = React.useState<Producto | null>(null)
  const [productoHistorial, setProductoHistorial] = React.useState<Producto | null>(null)
  const [productoForm, setProductoForm] = React.useState<ProductoForm>(emptyProducto())
  const [movimientoForm, setMovimientoForm] = React.useState({
    productoId: "",
    tipo: "Entrada",
    cantidad: "",
    costoUnitario: "",
    referencia: "",
    ordenId: "",
    notas: "",
  })

  const cargar = React.useCallback(async () => {
    setCargando(true)
    const [productosRes, movimientosRes] = await Promise.all([
      supabase.from("inventario_productos").select("*").order("nombre"),
      supabase
        .from("inventario_movimientos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ])
    if (productosRes.error) toast.error("No se pudo cargar el inventario.")
    if (movimientosRes.error) toast.error("No se pudo cargar el historial de movimientos.")
    setProductos((productosRes.data ?? []) as Producto[])
    setMovimientos((movimientosRes.data ?? []) as Movimiento[])
    setCargando(false)
  }, [supabase])

  React.useEffect(() => {
    void cargar()
  }, [cargar])

  const bajos = productos.filter((p) => p.activo && p.stock <= p.stock_minimo)
  const valorInventario = productos.reduce((acc, p) => acc + p.stock * p.costo, 0)

  const filtrados = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => {
      if (soloBajoStock && !(p.activo && p.stock <= p.stock_minimo)) return false
      if (!q) return true
      return [p.codigo, p.nombre, p.categoria, p.marca ?? "", p.modelo ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [productos, busqueda, soloBajoStock])

  const abrirNuevo = () => {
    setProductoEditando(null)
    setProductoForm(emptyProducto())
    setProductoOpen(true)
  }

  const abrirEditar = (producto: Producto) => {
    setProductoEditando(producto)
    setProductoForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? "",
      categoria: producto.categoria,
      marca: producto.marca ?? "",
      modelo: producto.modelo ?? "",
      unidad: producto.unidad,
      costo: String(producto.costo),
      precioVenta: String(producto.precio_venta),
      stockMinimo: String(producto.stock_minimo),
      ubicacion: producto.ubicacion ?? "",
      activo: producto.activo,
    })
    setProductoOpen(true)
  }

  const guardarProducto = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editable) return
    if (!productoForm.codigo.trim() || !productoForm.nombre.trim()) {
      toast.error("Código y nombre son obligatorios.")
      return
    }

    const payload = {
      codigo: productoForm.codigo.trim(),
      nombre: productoForm.nombre.trim(),
      descripcion: productoForm.descripcion.trim() || null,
      categoria: productoForm.categoria.trim() || "General",
      marca: productoForm.marca.trim() || null,
      modelo: productoForm.modelo.trim() || null,
      unidad: productoForm.unidad,
      costo: Number(productoForm.costo) || 0,
      precio_venta: Number(productoForm.precioVenta) || 0,
      stock_minimo: Number(productoForm.stockMinimo) || 0,
      ubicacion: productoForm.ubicacion.trim() || null,
      activo: productoForm.activo,
    }

    const result = productoEditando
      ? await supabase
          .from("inventario_productos")
          .update(payload)
          .eq("id", productoEditando.id)
          .select("*")
          .single()
      : await supabase
          .from("inventario_productos")
          .insert({ ...payload, creado_por: usuarioActual.id })
          .select("*")
          .single()

    if (result.error || !result.data) {
      toast.error(result.error?.message || "No se pudo guardar el producto.")
      return
    }

    toast.success(productoEditando ? "Producto actualizado." : "Producto creado.")
    setProductoOpen(false)
    await cargar()
  }

  const registrarMovimiento = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editable) return
    const cantidad = Number(movimientoForm.cantidad)
    if (!movimientoForm.productoId || !Number.isFinite(cantidad) || cantidad <= 0) {
      toast.error("Selecciona un producto e indica una cantidad válida.")
      return
    }
    const result = await supabase
      .from("inventario_movimientos")
      .insert({
        producto_id: movimientoForm.productoId,
        tipo: movimientoForm.tipo,
        cantidad,
        costo_unitario: Number(movimientoForm.costoUnitario) || 0,
        referencia: movimientoForm.referencia.trim() || null,
        orden_id: movimientoForm.ordenId || null,
        notas: movimientoForm.notas.trim() || null,
        creado_por: usuarioActual.id,
      })
      .select("*")
      .single()

    if (result.error || !result.data) {
      toast.error(result.error?.message || "No se pudo registrar el movimiento.")
      return
    }

    toast.success("Movimiento registrado y stock actualizado.")
    setMovimientoOpen(false)
    setMovimientoForm({
      productoId: "",
      tipo: "Entrada",
      cantidad: "",
      costoUnitario: "",
      referencia: "",
      ordenId: "",
      notas: "",
    })
    await cargar()
  }

  const abrirMovimiento = (producto?: Producto) => {
    setMovimientoForm((prev) => ({ ...prev, productoId: producto?.id ?? "" }))
    setMovimientoOpen(true)
  }

  const abrirHistorial = (producto: Producto) => {
    setProductoHistorial(producto)
    setHistorialOpen(true)
  }

  const movimientosProducto = productoHistorial
    ? movimientos.filter((m) => m.producto_id === productoHistorial.id)
    : []

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Productos, existencias, movimientos y alertas de stock."
        actions={
          editable ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => abrirMovimiento()}>
                <History data-icon="inline-start" />
                Movimiento
              </Button>
              <Button onClick={abrirNuevo}>
                <PackagePlus data-icon="inline-start" />
                Nuevo producto
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Productos" value={String(productos.length)} icon={Boxes} hint={`${productos.filter((p) => p.activo).length} activos`} />
        <StatCard label="Stock bajo" value={String(bajos.length)} icon={TriangleAlert} hint="Requieren reposición" accent={bajos.length ? "destructive" : undefined} />
        <StatCard label="Valor de inventario" value={formatMoneda(valorInventario)} icon={PackagePlus} hint="A costo registrado" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Catálogo y existencias</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 sm:w-72">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Código, producto, marca…" className="pl-9" />
              </div>
              <Button variant={soloBajoStock ? "default" : "outline"} onClick={() => setSoloBajoStock((v) => !v)}>
                <TriangleAlert data-icon="inline-start" />
                {soloBajoStock ? "Mostrando bajos" : "Stock bajo"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cargando ? (
            <p className="text-sm text-muted-foreground">Cargando inventario…</p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos que coincidan con el filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead className="hidden sm:table-cell">Mínimo</TableHead>
                    <TableHead className="hidden lg:table-cell">Ubicación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((p) => {
                    const bajo = p.activo && p.stock <= p.stock_minimo
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.codigo}</TableCell>
                        <TableCell>
                          <div className="font-medium">{p.nombre}</div>
                          <div className="text-xs text-muted-foreground">{[p.marca, p.modelo].filter(Boolean).join(" · ") || p.unidad}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{p.categoria}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={bajo ? "font-semibold text-destructive" : "font-medium"}>{p.stock} {p.unidad}</span>
                            {bajo && <Badge variant="destructive">Bajo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{p.stock_minimo}</TableCell>
                        <TableCell className="hidden lg:table-cell">{p.ubicacion || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => abrirHistorial(p)} aria-label={`Historial de ${p.nombre}`}>
                              <History className="size-4" />
                            </Button>
                            {editable && (
                              <>
                                <Button variant="ghost" size="icon-sm" onClick={() => abrirMovimiento(p)} aria-label={`Movimiento de ${p.nombre}`}>
                                  <PackagePlus className="size-4" />
                                </Button>
                                <Button variant="ghost" size="icon-sm" onClick={() => abrirEditar(p)} aria-label={`Editar ${p.nombre}`}>
                                  <Edit3 className="size-4" />
                                </Button>
                              </>
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

      <Dialog open={productoOpen} onOpenChange={setProductoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={guardarProducto}>
            <DialogHeader>
              <DialogTitle>{productoEditando ? `Editar ${productoEditando.nombre}` : "Nuevo producto"}</DialogTitle>
              <DialogDescription>El stock inicial se registra mediante un movimiento para conservar el historial.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field><FieldLabel>Código</FieldLabel><Input value={productoForm.codigo} onChange={(e) => setProductoForm((p) => ({ ...p, codigo: e.target.value }))} required /></Field>
                <Field><FieldLabel>Nombre</FieldLabel><Input value={productoForm.nombre} onChange={(e) => setProductoForm((p) => ({ ...p, nombre: e.target.value }))} required /></Field>
                <Field><FieldLabel>Categoría</FieldLabel><Input value={productoForm.categoria} onChange={(e) => setProductoForm((p) => ({ ...p, categoria: e.target.value }))} /></Field>
                <Field><FieldLabel>Unidad</FieldLabel><Select value={productoForm.unidad} onValueChange={(v) => setProductoForm((p) => ({ ...p, unidad: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></Field>
                <Field><FieldLabel>Marca</FieldLabel><Input value={productoForm.marca} onChange={(e) => setProductoForm((p) => ({ ...p, marca: e.target.value }))} /></Field>
                <Field><FieldLabel>Modelo / número de parte</FieldLabel><Input value={productoForm.modelo} onChange={(e) => setProductoForm((p) => ({ ...p, modelo: e.target.value }))} /></Field>
                <Field><FieldLabel>Costo unitario</FieldLabel><Input type="number" min="0" step="0.01" value={productoForm.costo} onChange={(e) => setProductoForm((p) => ({ ...p, costo: e.target.value }))} /></Field>
                <Field><FieldLabel>Precio de venta</FieldLabel><Input type="number" min="0" step="0.01" value={productoForm.precioVenta} onChange={(e) => setProductoForm((p) => ({ ...p, precioVenta: e.target.value }))} /></Field>
                <Field><FieldLabel>Stock mínimo</FieldLabel><Input type="number" min="0" step="0.001" value={productoForm.stockMinimo} onChange={(e) => setProductoForm((p) => ({ ...p, stockMinimo: e.target.value }))} /></Field>
                <Field><FieldLabel>Ubicación</FieldLabel><Input value={productoForm.ubicacion} onChange={(e) => setProductoForm((p) => ({ ...p, ubicacion: e.target.value }))} placeholder="Almacén A · Estante 2" /></Field>
              </div>
              <Field><FieldLabel>Descripción</FieldLabel><Textarea rows={3} value={productoForm.descripcion} onChange={(e) => setProductoForm((p) => ({ ...p, descripcion: e.target.value }))} /></Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductoOpen(false)}>Cancelar</Button>
              <Button type="submit">{productoEditando ? "Guardar cambios" : "Crear producto"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={movimientoOpen} onOpenChange={setMovimientoOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={registrarMovimiento}>
            <DialogHeader>
              <DialogTitle>Registrar movimiento</DialogTitle>
              <DialogDescription>El stock se actualiza automáticamente y no se permite dejar existencias negativas.</DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-2">
              <Field>
                <FieldLabel>Producto</FieldLabel>
                <Select value={movimientoForm.productoId} onValueChange={(v) => setMovimientoForm((p) => ({ ...p, productoId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger>
                  <SelectContent>{productos.filter((p) => p.activo).map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo} · {p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field><FieldLabel>Tipo</FieldLabel><Select value={movimientoForm.tipo} onValueChange={(v) => setMovimientoForm((p) => ({ ...p, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_MOVIMIENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></Field>
                <Field><FieldLabel>{movimientoForm.tipo === "Ajuste" ? "Stock nuevo" : "Cantidad"}</FieldLabel><Input type="number" min="0" step="0.001" value={movimientoForm.cantidad} onChange={(e) => setMovimientoForm((p) => ({ ...p, cantidad: e.target.value }))} required /></Field>
                <Field><FieldLabel>Costo unitario</FieldLabel><Input type="number" min="0" step="0.01" value={movimientoForm.costoUnitario} onChange={(e) => setMovimientoForm((p) => ({ ...p, costoUnitario: e.target.value }))} /></Field>
                <Field><FieldLabel>Referencia</FieldLabel><Input value={movimientoForm.referencia} onChange={(e) => setMovimientoForm((p) => ({ ...p, referencia: e.target.value }))} placeholder="Factura, compra, vale…" /></Field>
              </div>
              <Field><FieldLabel>Orden de servicio (opcional)</FieldLabel><Select value={movimientoForm.ordenId || "ninguna"} onValueChange={(v) => setMovimientoForm((p) => ({ ...p, ordenId: v === "ninguna" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ninguna">Sin orden</SelectItem>{ordenes.map((o) => <SelectItem key={o.id} value={o.id}>{o.folio}</SelectItem>)}</SelectContent></Select></Field>
              <Field><FieldLabel>Notas</FieldLabel><Textarea rows={2} value={movimientoForm.notas} onChange={(e) => setMovimientoForm((p) => ({ ...p, notas: e.target.value }))} /></Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovimientoOpen(false)}>Cancelar</Button>
              <Button type="submit">Registrar movimiento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historialOpen} onOpenChange={setHistorialOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de {productoHistorial?.nombre}</DialogTitle>
            <DialogDescription>Movimientos que explican la existencia actual.</DialogDescription>
          </DialogHeader>
          {movimientosProducto.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Aún no hay movimientos para este producto.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Cantidad</TableHead><TableHead>Antes</TableHead><TableHead>Después</TableHead><TableHead>Referencia</TableHead></TableRow></TableHeader>
                <TableBody>{movimientosProducto.map((m) => <TableRow key={m.id}><TableCell>{new Date(m.created_at).toLocaleString("es-MX")}</TableCell><TableCell>{m.tipo}</TableCell><TableCell>{m.cantidad}</TableCell><TableCell>{m.stock_anterior}</TableCell><TableCell className="font-medium">{m.stock_nuevo}</TableCell><TableCell>{m.referencia || "—"}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

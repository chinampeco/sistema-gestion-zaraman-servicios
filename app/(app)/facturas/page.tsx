"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, Search, FileText } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { FacturaFormDialog } from "@/components/facturas/factura-form-dialog"
import { EstadoFacturaBadge } from "@/components/status-badges"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useStore } from "@/lib/store"
import { formatFecha, formatMoneda } from "@/lib/format"
import { ESTADOS_FACTURA, type EstadoFactura } from "@/lib/types"

export default function FacturasPage() {
  const { facturas, clientes, cargando } = useStore()
  const [formOpen, setFormOpen] = React.useState(false)
  const [busqueda, setBusqueda] = React.useState("")
  const [estado, setEstado] = React.useState<EstadoFactura | "Todos">("Todos")

  const nombreCliente = React.useCallback(
    (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—",
    [clientes],
  )

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return facturas.filter((f) => {
      if (estado !== "Todos" && f.estado !== estado) return false
      if (!q) return true
      return (
        f.folio.toLowerCase().includes(q) ||
        nombreCliente(f.clienteId).toLowerCase().includes(q)
      )
    })
  }, [facturas, busqueda, estado, nombreCliente])

  return (
    <>
      <PageHeader
        title="Facturación"
        description="Facturas emitidas, importes y estados de pago."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            Nueva factura
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por folio o cliente…"
            className="pl-9"
          />
        </div>
        <Select
          value={estado}
          onValueChange={(v) => setEstado(v as EstadoFactura | "Todos")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos los estados</SelectItem>
            {ESTADOS_FACTURA.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!cargando && filtradas.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Sin facturas</EmptyTitle>
            <EmptyDescription>
              {facturas.length === 0
                ? "Aún no has registrado facturas. Crea la primera o factura una orden terminada."
                : "No hay facturas que coincidan con el filtro."}
            </EmptyDescription>
          </EmptyHeader>
          {facturas.length === 0 && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus data-icon="inline-start" />
              Nueva factura
            </Button>
          )}
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Total
                </TableHead>
                <TableHead className="hidden text-right lg:table-cell">
                  Saldo
                </TableHead>
                <TableHead className="hidden sm:table-cell">Emisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono font-medium">{f.folio}</TableCell>
                  <TableCell>{nombreCliente(f.clienteId)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {formatMoneda(f.total)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {formatMoneda(f.saldo)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {f.fechaEmision ? formatFecha(f.fechaEmision) : "—"}
                  </TableCell>
                  <TableCell>
                    <EstadoFacturaBadge estado={f.estado} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/facturas/${f.id}`} />}
                      nativeButton={false}
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FacturaFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  )
}

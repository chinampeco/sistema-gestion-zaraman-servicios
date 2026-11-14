"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileSignature, Plus, Search, Sparkles } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ContratoFormDialog } from "@/components/contratos/contrato-form-dialog"
import { EstadoContratoBadge } from "@/components/contratos/estado-contrato-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { createClient } from "@/lib/supabase/client"
import { useStore } from "@/lib/store"
import { formatFecha } from "@/lib/format"
import { puedeGestionarContratos } from "@/lib/permisos"
import { ESTADOS_CONTRATO, formatoMoneda, mapContrato, type Contrato } from "@/lib/contratos"

export default function ContratosPage() {
  const router = useRouter()
  const { clientes, usuarioActual, empresaActiva } = useStore()
  const [contratos, setContratos] = React.useState<Contrato[] | null>(null)
  const [query, setQuery] = React.useState("")
  const [estado, setEstado] = React.useState("todos")
  const [nuevoAbierto, setNuevoAbierto] = React.useState(false)
  const puedeGestionar = puedeGestionarContratos(usuarioActual.rol)

  React.useEffect(() => {
    let vigente = true
    createClient()
      .from("contratos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (vigente) setContratos((data ?? []).map(mapContrato))
      })
    return () => {
      vigente = false
    }
  }, [empresaActiva?.id])

  const nombreCliente = (id: string) => clientes.find((c) => c.id === id)?.nombre ?? "—"

  const filtrados = (contratos ?? []).filter((c) => {
    const q = query.trim().toLowerCase()
    const coincide =
      !q ||
      c.numeroContrato.toLowerCase().includes(q) ||
      c.objeto.toLowerCase().includes(q) ||
      nombreCliente(c.clienteId).toLowerCase().includes(q)
    return coincide && (estado === "todos" || c.estado === estado)
  })

  return (
    <>
      <PageHeader
        title="Contratos"
        description={`Contratos de ${empresaActiva?.nombreComercial ?? "la empresa"}, sus partidas y su expediente digital.`}
        actions={
          puedeGestionar ? (
            <div className="flex flex-wrap gap-2">
              <Button render={<Link href="/contratos/importar" />} nativeButton={false}>
                <Sparkles data-icon="inline-start" />
                Nuevo desde documentos
              </Button>
              <Button variant="outline" onClick={() => setNuevoAbierto(true)}>
                <Plus data-icon="inline-start" />
                Captura manual
              </Button>
            </div>
          ) : null
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número, objeto o dependencia…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
            </div>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as string)}
              items={[{ value: "todos", label: "Todos los estados" }, ...ESTADOS_CONTRATO.map((e) => ({ value: e, label: e }))]}
            >
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_CONTRATO.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {contratos === null ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filtrados.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileSignature /></EmptyMedia>
                <EmptyTitle>{contratos.length === 0 ? "Sin contratos" : "Sin resultados"}</EmptyTitle>
                <EmptyDescription>
                  {contratos.length === 0
                    ? "Registra el primer contrato de esta empresa para llevar sus partidas, órdenes y expediente."
                    : "No hay contratos con ese criterio."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="hidden md:table-cell">Dependencia</TableHead>
                    <TableHead className="hidden lg:table-cell">Vigencia</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="max-w-96">
                        <Link href={`/contratos/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.numeroContrato}
                        </Link>
                        <div className="line-clamp-2 text-xs text-muted-foreground">{c.objeto || "—"}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{nombreCliente(c.clienteId)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm lg:table-cell">
                        {formatFecha(c.vigenciaInicio)} – {formatFecha(c.vigenciaFin)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatoMoneda(c.total, c.moneda)}</TableCell>
                      <TableCell><EstadoContratoBadge estado={c.estado} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {puedeGestionar && (
        <ContratoFormDialog
          open={nuevoAbierto}
          onOpenChange={setNuevoAbierto}
          onGuardado={(c) => router.push(`/contratos/${c.id}`)}
        />
      )}
    </>
  )
}

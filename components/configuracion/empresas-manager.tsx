"use client"

import * as React from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { empresaToDb } from "@/lib/mappers"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { Empresa } from "@/lib/types"
import { LogoEmpresa } from "@/components/empresas/logo-empresa"

type FormEmpresa = {
  clave: string
  nombreComercial: string
  razonSocial: string
  rfc: string
  domicilio: string
  telefono: string
  email: string
  prefijoFolio: string
  activa: boolean
  representanteLegal: string
  representanteCargo: string
  giro: string
}

const VACIA: FormEmpresa = {
  clave: "",
  nombreComercial: "",
  razonSocial: "",
  rfc: "",
  domicilio: "",
  telefono: "",
  email: "",
  prefijoFolio: "",
  activa: true,
  representanteLegal: "",
  representanteCargo: "Representante Legal",
  giro: "",
}

// Alta y edición de las empresas (razones sociales) del sistema. Solo Administrador.
export function EmpresasManager() {
  const { todasEmpresas, empresaActiva, usuarioActual, recargar } = useStore()
  const [editando, setEditando] = React.useState<Empresa | null>(null)
  const [creando, setCreando] = React.useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreando(true)}>
          <Plus className="size-4" />
          Nueva empresa
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="hidden md:table-cell">RFC</TableHead>
              <TableHead className="hidden sm:table-cell">Folios</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {todasEmpresas.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <LogoEmpresa empresa={e} className="h-8 w-14" />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {e.nombreComercial}
                        {e.id === empresaActiva?.id && (
                          <Badge variant="secondary" className="ml-2">
                            En uso
                          </Badge>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{e.razonSocial}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {e.rfc || "—"}
                </TableCell>
                <TableCell className="hidden font-mono text-xs sm:table-cell">
                  {e.prefijoFolio ? `${e.prefijoFolio}-OS-000001` : "OS-000001"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={e.activa ? "success" : "secondary"}>
                    {e.activa ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setEditando(e)}
                    aria-label={`Editar ${e.nombreComercial}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {creando && (
        <EmpresaDialog
          empresa={null}
          usuarioId={usuarioActual.id}
          onClose={() => setCreando(false)}
          onGuardado={recargar}
        />
      )}
      {editando && (
        <EmpresaDialog
          empresa={editando}
          usuarioId={usuarioActual.id}
          onClose={() => setEditando(null)}
          onGuardado={recargar}
        />
      )}
    </div>
  )
}

function EmpresaDialog({
  empresa,
  usuarioId,
  onClose,
  onGuardado,
}: {
  empresa: Empresa | null
  usuarioId: string
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const esNueva = empresa === null
  const [form, setForm] = React.useState<FormEmpresa>(
    empresa
      ? {
          clave: empresa.clave,
          nombreComercial: empresa.nombreComercial,
          razonSocial: empresa.razonSocial,
          rfc: empresa.rfc,
          domicilio: empresa.domicilio,
          telefono: empresa.telefono,
          email: empresa.email,
          prefijoFolio: empresa.prefijoFolio ?? "",
          activa: empresa.activa,
          representanteLegal: empresa.representanteLegal,
          representanteCargo: empresa.representanteCargo,
          giro: empresa.giro,
        }
      : VACIA,
  )
  const [guardando, setGuardando] = React.useState(false)
  const set = (campo: keyof FormEmpresa) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  async function guardar() {
    if (!form.nombreComercial.trim() || !form.razonSocial.trim()) {
      toast.error("El nombre comercial y la razón social son obligatorios.")
      return
    }
    if (esNueva) {
      if (!/^[A-Z0-9_-]{2,20}$/.test(form.clave.trim().toUpperCase())) {
        toast.error("La clave debe tener de 2 a 20 letras o números, sin espacios.")
        return
      }
      if (!/^[A-Z0-9]{2,6}$/.test(form.prefijoFolio.trim().toUpperCase())) {
        toast.error("El prefijo de folios debe tener de 2 a 6 letras o números.")
        return
      }
    }

    setGuardando(true)
    const supabase = createClient()
    if (esNueva) {
      const { data, error } = await supabase
        .from("empresas")
        .insert(empresaToDb(form))
        .select("id")
        .single()
      if (error || !data) {
        setGuardando(false)
        toast.error(
          error?.message.includes("duplicate")
            ? "Ya existe una empresa con esa clave o ese prefijo de folios."
            : "No se pudo crear la empresa.",
        )
        return
      }
      // Quien la crea queda con acceso para poder entrar a configurarla.
      await supabase.from("usuario_empresas").insert({ usuario_id: usuarioId, empresa_id: data.id })
      toast.success("Empresa creada. Ya puedes seleccionarla en el encabezado.")
    } else {
      // La clave y el prefijo no se cambian: los folios emitidos dependen de ellos.
      const { clave: _clave, prefijoFolio: _prefijo, ...editable } = form
      const { error } = await supabase
        .from("empresas")
        .update(empresaToDb(editable))
        .eq("id", empresa.id)
      if (error) {
        setGuardando(false)
        toast.error("No se pudieron guardar los cambios.")
        return
      }
      toast.success("Empresa actualizada.")
    }
    setGuardando(false)
    onClose()
    await onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esNueva ? "Nueva empresa" : "Editar empresa"}</DialogTitle>
          <DialogDescription>
            {esNueva
              ? "Cada empresa tiene sus propios clientes, órdenes, cotizaciones, facturas e inventario."
              : empresa.razonSocial}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="emp-clave">Clave</FieldLabel>
              <Input
                id="emp-clave"
                value={form.clave}
                onChange={set("clave")}
                disabled={!esNueva}
                placeholder="BOCAM"
                className="uppercase"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-prefijo">Prefijo de folios</FieldLabel>
              <Input
                id="emp-prefijo"
                value={form.prefijoFolio}
                onChange={set("prefijoFolio")}
                disabled={!esNueva}
                placeholder="BOC"
                className="uppercase"
              />
            </Field>
          </div>
          <FieldDescription>
            {esNueva
              ? `Folios de ejemplo: ${(form.prefijoFolio || "XXX").toUpperCase()}-OS-000001, ${(form.prefijoFolio || "XXX").toUpperCase()}-COT-000001. La clave y el prefijo no se pueden cambiar después.`
              : "La clave y el prefijo de folios no se pueden cambiar porque los folios ya emitidos dependen de ellos."}
          </FieldDescription>
          <Field>
            <FieldLabel htmlFor="emp-nombre">Nombre comercial</FieldLabel>
            <Input id="emp-nombre" value={form.nombreComercial} onChange={set("nombreComercial")} />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-razon">Razón social</FieldLabel>
            <Input
              id="emp-razon"
              value={form.razonSocial}
              onChange={set("razonSocial")}
              placeholder="EMPRESA S.A. de C.V."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-rfc">RFC</FieldLabel>
            <Input id="emp-rfc" value={form.rfc} onChange={set("rfc")} className="uppercase" />
          </Field>
          <Field>
            <FieldLabel htmlFor="emp-domicilio">Domicilio fiscal</FieldLabel>
            <Textarea id="emp-domicilio" rows={2} value={form.domicilio} onChange={set("domicilio")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="emp-telefono">Teléfono</FieldLabel>
              <Input id="emp-telefono" value={form.telefono} onChange={set("telefono")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-email">Correo</FieldLabel>
              <Input id="emp-email" type="email" value={form.email} onChange={set("email")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="emp-rep">Representante legal</FieldLabel>
              <Input id="emp-rep" value={form.representanteLegal} onChange={set("representanteLegal")} placeholder="Nombre completo como firma" />
            </Field>
            <Field>
              <FieldLabel htmlFor="emp-rep-cargo">Cargo</FieldLabel>
              <Input id="emp-rep-cargo" value={form.representanteCargo} onChange={set("representanteCargo")} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="emp-giro">Giro / servicios (encabezado de formatos)</FieldLabel>
            <Textarea id="emp-giro" rows={2} value={form.giro} onChange={set("giro")} />
          </Field>
          {!esNueva && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="emp-activa">Empresa activa</Label>
                <span className="text-xs text-muted-foreground">
                  Una empresa inactiva no aparece en el selector; sus datos se conservan.
                </span>
              </div>
              <Switch
                id="emp-activa"
                checked={form.activa}
                onCheckedChange={(v) => setForm((f) => ({ ...f, activa: v }))}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : esNueva ? "Crear empresa" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { Building2, Mail, MapPin, Phone, User } from "lucide-react"

import { useStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function Dato({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-sm">{valor || "—"}</span>
      </div>
    </div>
  )
}

export default function PortalPerfilPage() {
  const { usuarioActual, clientes, cargando } = useStore()
  const cliente = clientes.find((c) => c.id === usuarioActual.clienteId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Tus datos de contacto registrados.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del cliente</CardTitle>
          <CardDescription>
            Si algún dato es incorrecto, crea un ticket para solicitar su actualización.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!cliente ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {cargando ? "Cargando…" : "No hay datos de cliente asociados a tu cuenta."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Dato icon={Building2} label="Nombre / Razón social" valor={cliente.nombre} />
              <Dato icon={User} label="Contacto" valor={cliente.contacto} />
              <Dato icon={Mail} label="Correo electrónico" valor={cliente.email} />
              <Dato icon={Phone} label="Teléfono" valor={cliente.telefono} />
              <Dato icon={MapPin} label="Dirección" valor={cliente.direccion} />
              <Dato icon={MapPin} label="Ciudad" valor={cliente.ciudad} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

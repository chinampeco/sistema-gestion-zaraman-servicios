"use client"

import * as React from "react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Field, FieldGroup, FieldLabel, FieldDescription } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { UsuariosManager } from "@/components/configuracion/usuarios-manager"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { iniciales } from "@/lib/format"
import { puedeGestionarUsuarios } from "@/lib/permisos"
import { toast } from "sonner"

export default function ConfiguracionPage() {
  const { usuarioActual } = useStore()
  const esAdmin = puedeGestionarUsuarios(usuarioActual.rol)

  const [nombre, setNombre] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)

  const [nombreEmpresa, setNombreEmpresa] = React.useState("ZARAMAN SA de CV")
  const [prefijoFolio, setPrefijoFolio] = React.useState("OS")
  const [notifCorreo, setNotifCorreo] = React.useState(true)
  const [recordatorios, setRecordatorios] = React.useState(true)

  React.useEffect(() => {
    if (usuarioActual.id) {
      setNombre(usuarioActual.nombre)
      setEmail(usuarioActual.email)
    }
  }, [usuarioActual.id, usuarioActual.nombre, usuarioActual.email])

  async function guardarPerfil() {
    if (!usuarioActual.id) return
    setGuardando(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ nombre_completo: nombre })
      .eq("id", usuarioActual.id)
    setGuardando(false)
    if (error) {
      toast.error("No se pudo actualizar el perfil.")
      return
    }
    toast.success("Perfil actualizado.")
  }

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Administra tu perfil, usuarios y preferencias generales."
      />

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Perfil del usuario</CardTitle>
              <CardDescription>
                Actualiza tu información personal.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarFallback className="text-lg">
                    {iniciales(usuarioActual.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{usuarioActual.nombre}</span>
                  <Badge variant="secondary" className="w-fit">
                    {usuarioActual.rol}
                  </Badge>
                </div>
              </div>

              <Separator />

              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="perfil-nombre">
                      Nombre completo
                    </FieldLabel>
                    <Input
                      id="perfil-nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="perfil-email">Correo</FieldLabel>
                    <Input
                      id="perfil-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={guardarPerfil} disabled={guardando}>
                Guardar cambios
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Usuarios */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios</CardTitle>
              <CardDescription>
                {esAdmin
                  ? "Crea y administra las cuentas de personal con acceso al panel."
                  : "Personas con acceso a ZARAMAN Servicios."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsuariosManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* General */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configuración general</CardTitle>
              <CardDescription>
                Preferencias de la aplicación y de órdenes de servicio.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="empresa">Nombre de la empresa</FieldLabel>
                    <Input
                      id="empresa"
                      value={nombreEmpresa}
                      onChange={(e) => setNombreEmpresa(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="prefijo">Prefijo de folio</FieldLabel>
                    <Input
                      id="prefijo"
                      value={prefijoFolio}
                      onChange={(e) => setPrefijoFolio(e.target.value)}
                    />
                    <FieldDescription>
                      Ejemplo: {prefijoFolio || "OS"}-000001
                    </FieldDescription>
                  </Field>
                </div>
              </FieldGroup>

              <Separator />

              <div className="flex flex-col gap-4">
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="notif-correo">
                      Notificaciones por correo
                    </FieldLabel>
                    <FieldDescription>
                      Recibe avisos cuando cambie el estado de una orden.
                    </FieldDescription>
                  </div>
                  <Switch
                    id="notif-correo"
                    checked={notifCorreo}
                    onCheckedChange={setNotifCorreo}
                  />
                </Field>
                <Field orientation="horizontal">
                  <div className="flex flex-col gap-0.5">
                    <FieldLabel htmlFor="recordatorios">
                      Recordatorios de servicio
                    </FieldLabel>
                    <FieldDescription>
                      Alertas de próximos servicios programados.
                    </FieldDescription>
                  </div>
                  <Switch
                    id="recordatorios"
                    checked={recordatorios}
                    onCheckedChange={setRecordatorios}
                  />
                </Field>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button
                onClick={() => toast.success("Configuración guardada")}
              >
                Guardar cambios
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}

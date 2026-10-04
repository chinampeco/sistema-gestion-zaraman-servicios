import Link from "next/link"
import { redirect } from "next/navigation"
import { Clock } from "lucide-react"

import { CerrarSesionButton } from "@/components/cerrar-sesion-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

// Pantalla para cuentas sin acceso al panel: recién registradas (inactivas
// hasta que el administrador las active) o de cliente, mientras el portal no
// esté disponible.
export default async function CuentaPendientePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle()

  const esCliente = perfil?.role === "cliente"
  const tieneAcceso = perfil?.active === true && !esCliente

  const titulo = tieneAcceso
    ? "Tu cuenta ya está activa"
    : esCliente
      ? "Portal de clientes en preparación"
      : "Cuenta pendiente de activación"

  const descripcion = tieneAcceso
    ? "El administrador ya activó tu cuenta. Ya puedes entrar al panel."
    : esCliente
      ? "El portal de clientes estará disponible próximamente. Te avisaremos cuando puedas consultar tus órdenes, cotizaciones y facturas."
      : "Tu cuenta se creó correctamente, pero un administrador debe activarla y asignarte un rol antes de que puedas entrar al panel."

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Clock className="size-6" />
          </div>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>{descripcion}</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Sesión iniciada como <span className="font-medium text-foreground">{user.email}</span>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          {tieneAcceso && (
            <Button className="w-full" render={<Link href="/" />} nativeButton={false}>
              Entrar al panel
            </Button>
          )}
          <CerrarSesionButton className="w-full" />
        </CardFooter>
      </Card>
    </div>
  )
}

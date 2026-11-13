"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { EmblemaPlataforma, MarcaPlataforma } from "@/components/marca/marca-plataforma"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cargando, setCargando] = React.useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(
        error.message.toLowerCase().includes("email not confirmed")
          ? "Debes confirmar tu correo antes de iniciar sesión."
          : "Correo o contraseña incorrectos.",
      )
      setCargando(false)
      return
    }
    // Después de iniciar sesión se elige la empresa (los clientes pasan directo al portal).
    router.push("/seleccionar-empresa")
    router.refresh()
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Panel de marca (solo en pantallas grandes) */}
      {/* El panel conserva el azul corporativo también en modo oscuro. */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex"
        style={{ "--primary": "oklch(0.47 0.15 256)", "--primary-foreground": "oklch(0.99 0 0)" } as React.CSSProperties}
      >
        <MarcaPlataforma tamano="lg" variante="claro" />
        <div className="relative z-10 flex max-w-md flex-col gap-4">
          <h2 className="text-3xl font-semibold leading-tight text-balance">
            Una sola plataforma para todas las empresas del grupo.
          </h2>
          <p className="text-pretty text-primary-foreground/80">
            Órdenes de servicio, cotizaciones, inventario, facturación y contratos de cada razón
            social, con su información separada y protegida.
          </p>
        </div>
        <p className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Plataforma Empresarial
        </p>
        <div aria-hidden className="pointer-events-none absolute -right-28 -bottom-28">
          <EmblemaPlataforma className="size-[26rem] text-primary-foreground/10 [&_g]:fill-primary" />
        </div>
      </aside>

      <main className="flex items-center justify-center bg-muted/40 p-4 sm:p-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <MarcaPlataforma />
            <p className="text-sm text-muted-foreground">
              Acceso para el personal de las empresas del grupo
            </p>
          </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa con tu cuenta; después eliges la empresa con la que vas a trabajar.
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo iniciar sesión</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresa.com"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="password"
                      type={verPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={verPassword ? "Ocultar contraseña" : "Ver contraseña"}
                      onClick={() => setVerPassword((v) => !v)}
                    >
                      {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="mt-4 flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={cargando}>
                {cargando && <Spinner data-icon="inline-start" />}
                Entrar
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link href="/auth/sign-up" className="font-medium text-primary underline-offset-4 hover:underline">
                  Crear cuenta
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
        </div>
      </main>
    </div>
  )
}

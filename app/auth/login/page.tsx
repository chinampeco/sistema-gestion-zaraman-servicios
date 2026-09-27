"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Wrench, Eye, EyeOff } from "lucide-react"

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
    router.push("/")
    router.refresh()
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ZARAMAN SERVICIOS</h1>
          <p className="text-sm text-muted-foreground">
            Sistema de gestión de servicios técnicos industriales
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Ingresa con tu cuenta corporativa.</CardDescription>
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
                    placeholder="usuario@zaraman.mx"
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
    </div>
  )
}

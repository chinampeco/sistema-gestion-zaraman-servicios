"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, KeyRound } from "lucide-react"

import { MarcaPlataforma } from "@/components/marca/marca-plataforma"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"

export default function CambiarPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [ver, setVer] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [guardando, setGuardando] = React.useState(false)

  React.useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) router.replace("/auth/login")
      })
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.")
    if (password !== confirmar) return setError("Las contraseñas no coinciden.")
    setGuardando(true)
    const r = await fetch("/api/cuenta/cambiar-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    const d = await r.json().catch(() => ({}))
    setGuardando(false)
    if (!r.ok) return setError(d.error ?? "No se pudo cambiar la contraseña.")
    router.replace("/seleccionar-empresa")
    router.refresh()
  }

  async function salir() {
    await createClient().auth.signOut()
    router.replace("/auth/login")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center"><MarcaPlataforma /></div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-5" />Crea tu contraseña</CardTitle>
            <CardDescription>
              Por seguridad, la contraseña que te dieron es temporal. Crea una nueva para continuar.
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo guardar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="nueva">Nueva contraseña</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input id="nueva" type={ver ? "text" : "password"} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"}>
                      {ver ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  <FieldDescription>Mínimo 8 caracteres. Combina letras y números; evita datos personales.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirmar">Confirma la contraseña</FieldLabel>
                  <Input id="confirmar" type={ver ? "text" : "password"} autoComplete="new-password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={guardando}>
                {guardando && <Spinner data-icon="inline-start" />}
                Guardar y continuar
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={salir}>Salir</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}

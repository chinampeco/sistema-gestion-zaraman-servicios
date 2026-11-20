"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"

import { MarcaPlataforma } from "@/components/marca/marca-plataforma"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import { cerrarSesion, registrarEventoSesion } from "@/lib/sesion"

type Estado =
  | { modo: "cargando" }
  | { modo: "activar"; factorId: string; qr: string; secreto: string }
  | { modo: "verificar"; factorId: string }

export default function VerificacionDosPasosPage() {
  const router = useRouter()
  const [estado, setEstado] = React.useState<Estado>({ modo: "cargando" })
  const [codigo, setCodigo] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()
    let cancelado = false
    ;(async () => {
      const { data: u } = await supabase.auth.getUser()
      if (!u.user) return router.replace("/auth/login")
      const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (nivel?.currentLevel === "aal2") return router.replace("/seleccionar-empresa")

      const { data: factores, error: e1 } = await supabase.auth.mfa.listFactors()
      if (e1) return setError(e1.message)
      const verificado = factores?.totp?.[0]
      if (verificado) {
        if (!cancelado) setEstado({ modo: "verificar", factorId: verificado.id })
        return
      }
      // Sin app registrada: se descartan intentos anteriores sin terminar y se registra una nueva.
      for (const f of factores?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error: e2 } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Sistema de gestión",
        issuer: "ZARAMAN",
      })
      if (e2 || !data) return setError(e2?.message ?? "No se pudo preparar la verificación.")
      if (!cancelado) setEstado({ modo: "activar", factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret })
    })()
    return () => {
      cancelado = true
    }
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (estado.modo === "cargando") return
    const limpio = codigo.replace(/\D/g, "")
    if (limpio.length !== 6) return setError("Escribe los 6 dígitos que muestra tu app.")
    setError(null)
    setEnviando(true)
    const { error: e1 } = await createClient().auth.mfa.challengeAndVerify({ factorId: estado.factorId, code: limpio })
    setEnviando(false)
    registrarEventoSesion("Verificación en dos pasos", !e1)
    if (e1) {
      setCodigo("")
      return setError("El código no es correcto o ya expiró. Escribe el que aparece ahora en tu app.")
    }
    router.replace("/seleccionar-empresa")
    router.refresh()
  }

  async function salir() {
    await cerrarSesion(createClient())
    router.replace("/auth/login")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center"><MarcaPlataforma /></div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />Verificación en dos pasos</CardTitle>
            <CardDescription>
              {estado.modo === "activar"
                ? "Tu cuenta administra el sistema, por eso además de la contraseña se pide un código de tu celular. Actívalo una sola vez:"
                : "Escribe el código de 6 dígitos que muestra tu app autenticadora."}
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo verificar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {estado.modo === "cargando" && !error && (
                <div className="flex justify-center py-6"><Spinner /></div>
              )}
              {estado.modo === "activar" && (
                <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
                  <li>
                    Instala en tu celular <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> (gratis).
                  </li>
                  <li className="flex flex-col gap-2">
                    En la app toca <strong>+</strong> → <strong>Escanear código QR</strong> y escanea este código:
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={estado.qr} alt="Código QR para la app autenticadora" className="size-44 self-center rounded-md border bg-white p-2" />
                    <span className="text-xs text-muted-foreground">
                      ¿No puedes escanear? Captura esta clave en la app:{" "}
                      <code className="break-all rounded bg-muted px-1 py-0.5 font-mono">{estado.secreto}</code>
                    </span>
                  </li>
                  <li>Escribe abajo el código de 6 dígitos que aparece en la app.</li>
                </ol>
              )}
              {estado.modo !== "cargando" && (
                <Field>
                  <FieldLabel htmlFor="codigo">Código</FieldLabel>
                  <Input
                    id="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={7}
                    placeholder="123456"
                    className="text-center font-mono text-lg tracking-widest"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    autoFocus
                    required
                  />
                  <FieldDescription>El código cambia cada 30 segundos.</FieldDescription>
                </Field>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={enviando || estado.modo === "cargando"}>
                {enviando && <Spinner data-icon="inline-start" />}
                {estado.modo === "activar" ? "Activar y continuar" : "Verificar"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={salir}>Salir</Button>
              {estado.modo === "verificar" && (
                <p className="text-center text-xs text-muted-foreground">
                  ¿Perdiste o cambiaste de celular? Pide a un administrador que reinicie tu verificación en dos pasos.
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}

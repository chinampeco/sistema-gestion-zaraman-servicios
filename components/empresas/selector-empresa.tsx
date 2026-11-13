"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, ChevronRight, LogOut } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase/client"
import type { Empresa } from "@/lib/types"

export function SelectorEmpresa({
  empresas,
  empresaActivaId,
  nombreUsuario,
}: {
  empresas: Empresa[]
  empresaActivaId: string | null
  nombreUsuario: string
}) {
  const router = useRouter()
  const [entrando, setEntrando] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function entrar(empresa: Empresa) {
    setEntrando(empresa.id)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc("seleccionar_empresa", { p_empresa_id: empresa.id })
    if (error) {
      setError("No tienes acceso a esa empresa.")
      setEntrando(null)
      return
    }
    router.push("/")
    router.refresh()
  }

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Selecciona la empresa</h1>
          <p className="text-sm text-muted-foreground">
            {nombreUsuario ? `${nombreUsuario}, elige` : "Elige"} con qué empresa vas a trabajar.
            Puedes cambiarla después desde el encabezado.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>No se pudo entrar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {empresas.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Sin empresas asignadas</CardTitle>
              <CardDescription>
                Tu cuenta todavía no tiene acceso a ninguna empresa. Pide a un administrador que
                te dé de alta en la empresa con la que vas a trabajar.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {empresas.map((empresa) => (
              <button
                key={empresa.id}
                type="button"
                onClick={() => entrar(empresa)}
                disabled={entrando !== null}
                className="text-left disabled:opacity-60"
              >
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Building2 className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{empresa.nombreComercial}</span>
                        {empresa.id === empresaActivaId && (
                          <Badge variant="secondary">Última usada</Badge>
                        )}
                      </div>
                      <span className="truncate text-sm text-muted-foreground">
                        {empresa.razonSocial}
                      </span>
                      {empresa.rfc && (
                        <span className="text-xs text-muted-foreground">RFC {empresa.rfc}</span>
                      )}
                    </div>
                    {entrando === empresa.id ? (
                      <Spinner />
                    ) : (
                      <ChevronRight className="size-5 text-muted-foreground" />
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}

        <Button variant="ghost" onClick={cerrarSesion} className="self-center">
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}

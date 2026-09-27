"use client"

import * as React from "react"
import { KeyRound, Copy, Check, ExternalLink, RefreshCw, Eye, EyeOff } from "lucide-react"

import type { Cliente } from "@/lib/types"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"

function generarPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  let out = ""
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copiado, setCopiado] = React.useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Copiar ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1500)
        } catch {
          // Ignorar si el navegador bloquea el portapapeles.
        }
      }}
    >
      {copiado ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
    </Button>
  )
}

export function PortalAccessDialog({
  open,
  onOpenChange,
  cliente,
  modo = "crear",
  emailExistente,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente: Cliente
  modo?: "crear" | "restablecer"
  emailExistente?: string
}) {
  const { recargar } = useStore()
  const esReset = modo === "restablecer"

  const [nombre, setNombre] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [cargando, setCargando] = React.useState(false)
  const [exito, setExito] = React.useState(false)
  const [loginUrl, setLoginUrl] = React.useState("")

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setLoginUrl(`${window.location.origin}/auth/login`)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setNombre(cliente.contacto || cliente.nombre)
      setEmail(esReset ? emailExistente ?? cliente.email ?? "" : cliente.email ?? "")
      setPassword("")
      setConfirmar("")
      setVerPassword(false)
      setError(null)
      setExito(false)
    }
  }, [open, cliente, esReset, emailExistente])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden. Verifícalas e intenta de nuevo.")
      return
    }
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/portal-access", {
        method: esReset ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          esReset
            ? { clienteId: cliente.id, password }
            : { clienteId: cliente.id, nombre, email, password },
        ),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "No se pudo completar la operación.")
        setCargando(false)
        return
      }
      await recargar()
      setExito(true)
    } catch {
      setError("Error de conexión. Intenta de nuevo.")
    }
    setCargando(false)
  }

  const emailMostrado = esReset ? emailExistente ?? cliente.email ?? "" : email

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {esReset ? "Restablecer contraseña" : "Crear acceso al portal"}
          </DialogTitle>
          <DialogDescription>
            {esReset
              ? `Genera una nueva contraseña para el acceso de ${cliente.nombre}.`
              : `Genera credenciales para que ${cliente.nombre} ingrese a su portal.`}
          </DialogDescription>
        </DialogHeader>

        {exito ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
            <Alert>
              <KeyRound className="size-4" />
              <AlertTitle>
                {esReset ? "Contraseña actualizada" : "Acceso creado correctamente"}
              </AlertTitle>
              <AlertDescription>
                {esReset
                  ? "Comparte la nueva contraseña con el cliente. No volverá a mostrarse."
                  : "Comparte estas credenciales con el cliente. La contraseña no volverá a mostrarse."}
              </AlertDescription>
            </Alert>
            <div className="rounded-md border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-muted-foreground">Correo</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono">{emailMostrado}</span>
                  <CopyButton value={emailMostrado} label="correo" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-muted-foreground">Contraseña</span>
                <span className="flex items-center gap-1">
                  <span className="font-mono">{password}</span>
                  <CopyButton value={password} label="contraseña" />
                </span>
              </div>
            </div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="font-medium text-foreground">¿Cómo ingresa el cliente?</p>
              <p className="mt-1 text-muted-foreground">
                El cliente abre la página de inicio de sesión y entra con el correo y la
                contraseña de arriba. La cuenta ya está activa: no necesita confirmar
                ningún correo ni usar la opción &quot;Crear cuenta&quot;.
              </p>
              {loginUrl && (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<a href={loginUrl} target="_blank" rel="noopener noreferrer" />}
                    nativeButton={false}
                  >
                    <ExternalLink data-icon="inline-start" />
                    Abrir inicio de sesión
                  </Button>
                  <CopyButton value={loginUrl} label="enlace de inicio de sesión" />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Entendido
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>No se pudo completar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                {!esReset && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="pa-nombre">Nombre del usuario</FieldLabel>
                      <Input
                        id="pa-nombre"
                        required
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Nombre de contacto"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="pa-email">Correo electrónico</FieldLabel>
                      <Input
                        id="pa-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="cliente@correo.com"
                      />
                    </Field>
                  </>
                )}
                {esReset && emailMostrado && (
                  <Field>
                    <FieldLabel>Correo del acceso</FieldLabel>
                    <Input value={emailMostrado} readOnly disabled />
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="pa-password">
                    {esReset ? "Nueva contraseña" : "Contraseña"}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="pa-password"
                      type={verPassword ? "text" : "password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Generar contraseña automática"
                      onClick={() => {
                        const nueva = generarPassword()
                        setPassword(nueva)
                        setConfirmar(nueva)
                        setVerPassword(true)
                      }}
                    >
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="pa-confirmar">Confirmar contraseña</FieldLabel>
                  <Input
                    id="pa-confirmar"
                    type={verPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    placeholder="Vuelve a escribir la contraseña"
                  />
                  {confirmar.length > 0 && password !== confirmar && (
                    <p className="text-sm text-destructive">Las contraseñas no coinciden.</p>
                  )}
                </Field>
              </FieldGroup>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={cargando}>
                    Cancelar
                  </Button>
                }
                nativeButton={false}
              />
              <Button type="submit" disabled={cargando}>
                {cargando && <Spinner data-icon="inline-start" />}
                {esReset ? "Restablecer contraseña" : "Crear acceso"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

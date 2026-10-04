"use client"

import * as React from "react"
import { Eye, EyeOff, KeyRound, MoreVertical, UserCheck, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatFecha, iniciales } from "@/lib/format"
import { DESCRIPCION_ROL, puedeGestionarUsuarios } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { ETIQUETA_ROL, ROLES_USUARIO, type RolUsuario } from "@/lib/types"

// Cuenta tal como la devuelve GET /api/usuarios.
interface CuentaUsuario {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
  clienteId: string | null
  createdAt: string
  correoConfirmado: boolean
}

export function UsuariosManager() {
  const { usuarioActual, clientes } = useStore()
  const esAdmin = puedeGestionarUsuarios(usuarioActual.rol)

  const [cuentas, setCuentas] = React.useState<CuentaUsuario[]>([])
  const [cargando, setCargando] = React.useState(true)
  const [crearAbierto, setCrearAbierto] = React.useState(false)
  const [editar, setEditar] = React.useState<{ cuenta: CuentaUsuario; activar: boolean } | null>(
    null,
  )

  const cargar = React.useCallback(async () => {
    const res = await fetch("/api/usuarios", { cache: "no-store" })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudieron cargar los usuarios.")
    } else {
      setCuentas((data?.usuarios ?? []) as CuentaUsuario[])
    }
    setCargando(false)
  }, [])

  React.useEffect(() => {
    if (esAdmin) cargar()
  }, [esAdmin, cargar])

  if (!esAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Solo el administrador puede ver y gestionar las cuentas de usuario.
      </p>
    )
  }

  const nombreEmpresa = (id: string | null) =>
    id ? clientes.find((c) => c.id === id)?.nombre ?? "—" : null

  const pendientes = cuentas.filter((c) => !c.activo)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setCrearAbierto(true)}>
          <UserPlus className="size-4" />
          Nuevo usuario
        </Button>
      </div>

      {pendientes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/40 p-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Pendientes de activación</span>
            <Badge variant="warning">{pendientes.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Cuentas registradas o desactivadas. No pueden entrar al panel hasta
            que les asignes un rol y las actives.
          </p>
          <ul className="flex flex-col divide-y divide-border">
            {pendientes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{c.nombre || c.email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.email} · registrado el {formatFecha(c.createdAt)}
                    {!c.correoConfirmado && " · correo sin confirmar"}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => setEditar({ cuenta: c, activar: true })}
                  disabled={c.id === usuarioActual.id}
                >
                  <UserCheck className="size-4" />
                  Asignar rol y activar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead className="hidden sm:table-cell">Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {iniciales(u.nombre || u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{u.nombre || u.email}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {u.email}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{ETIQUETA_ROL[u.rol] ?? u.rol}</span>
                    {u.rol === "cliente" && (
                      <span className="text-xs text-muted-foreground">
                        {nombreEmpresa(u.clienteId)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={u.activo ? "success" : "secondary"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Acciones</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditar({ cuenta: u, activar: false })}>
                        Editar usuario
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {cuentas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {cargando ? "Cargando usuarios…" : "No hay usuarios registrados."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CrearUsuarioDialog
        abierto={crearAbierto}
        onOpenChange={setCrearAbierto}
        onGuardado={cargar}
      />

      {editar && (
        <EditarUsuarioDialog
          key={editar.cuenta.id}
          cuenta={editar.cuenta}
          activar={editar.activar}
          esUnoMismo={editar.cuenta.id === usuarioActual.id}
          onClose={() => setEditar(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}

function RolSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: RolUsuario
  onChange: (v: RolUsuario) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(v as RolUsuario)}
      disabled={disabled}
    >
      <SelectTrigger id={id}>
        <SelectValue>{(v: string) => ETIQUETA_ROL[v as RolUsuario] ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ROLES_USUARIO.map((r) => (
          <SelectItem key={r} value={r}>
            <div className="flex flex-col">
              <span>{ETIQUETA_ROL[r]}</span>
              <span className="text-xs text-muted-foreground">{DESCRIPCION_ROL[r]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Empresa a la que se liga un usuario cliente. La asigna solo el administrador.
function EmpresaSelect({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (v: string) => void
  id?: string
}) {
  const { clientes } = useStore()
  return (
    <Field>
      <FieldLabel htmlFor={id}>Empresa</FieldLabel>
      <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Selecciona la empresa">
            {(v: string) => clientes.find((c) => c.id === v)?.nombre ?? "Selecciona la empresa"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {clientes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {clientes.length === 0
          ? "No hay empresas registradas. Crea primero el cliente."
          : "El usuario solo tendrá acceso a la información de esta empresa."}
      </p>
    </Field>
  )
}

function CrearUsuarioDialog({
  abierto,
  onOpenChange,
  onGuardado,
}: {
  abierto: boolean
  onOpenChange: (v: boolean) => void
  onGuardado: () => Promise<void>
}) {
  const [nombre, setNombre] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [rol, setRol] = React.useState<RolUsuario>("consulta")
  const [clienteId, setClienteId] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)

  React.useEffect(() => {
    if (abierto) {
      setNombre("")
      setEmail("")
      setPassword("")
      setConfirmar("")
      setRol("consulta")
      setClienteId("")
      setVerPassword(false)
    }
  }, [abierto])

  async function guardar() {
    if (!nombre.trim() || !email.trim()) {
      toast.error("Completa el nombre y el correo.")
      return
    }
    if (rol === "cliente" && !clienteId) {
      toast.error("Selecciona la empresa del usuario cliente.")
      return
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (password !== confirmar) {
      toast.error("Las contraseñas no coinciden.")
      return
    }
    setGuardando(true)
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        email,
        password,
        rol,
        clienteId: rol === "cliente" ? clienteId : null,
      }),
    })
    const data = await res.json().catch(() => null)
    setGuardando(false)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo crear el usuario.")
      return
    }
    toast.success("Usuario creado.")
    onOpenChange(false)
    await onGuardado()
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Crea una cuenta activa con el rol indicado. Comparte estas
            credenciales con la persona; podrá iniciar sesión de inmediato.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="nuevo-nombre">Nombre completo</FieldLabel>
            <Input
              id="nuevo-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nuevo-email">Correo electrónico</FieldLabel>
            <Input
              id="nuevo-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="nuevo-rol">Rol</FieldLabel>
            <RolSelect id="nuevo-rol" value={rol} onChange={setRol} />
          </Field>
          {rol === "cliente" && (
            <EmpresaSelect id="nuevo-empresa" value={clienteId} onChange={setClienteId} />
          )}
          <Field>
            <FieldLabel htmlFor="nuevo-password">Contraseña</FieldLabel>
            <div className="relative">
              <Input
                id="nuevo-password"
                type={verPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                aria-label={verPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="nuevo-confirmar">Confirmar contraseña</FieldLabel>
            <Input
              id="nuevo-confirmar"
              type={verPassword ? "text" : "password"}
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Creando..." : "Crear usuario"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditarUsuarioDialog({
  cuenta,
  activar,
  esUnoMismo,
  onClose,
  onGuardado,
}: {
  cuenta: CuentaUsuario
  // Abierto desde "Pendientes de activación": propone activar la cuenta.
  activar: boolean
  esUnoMismo: boolean
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const [nombre, setNombre] = React.useState(cuenta.nombre)
  const [rol, setRol] = React.useState<RolUsuario>(cuenta.rol)
  const [clienteId, setClienteId] = React.useState(cuenta.clienteId ?? "")
  const [activo, setActivo] = React.useState(activar ? true : cuenta.activo)
  const [guardando, setGuardando] = React.useState(false)

  const [cambiarPass, setCambiarPass] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)

  async function guardar() {
    if (rol === "cliente" && !clienteId) {
      toast.error("Selecciona la empresa del usuario cliente.")
      return
    }
    if (cambiarPass) {
      if (password.length < 6) {
        toast.error("La contraseña debe tener al menos 6 caracteres.")
        return
      }
      if (password !== confirmar) {
        toast.error("Las contraseñas no coinciden.")
        return
      }
    }
    setGuardando(true)
    const body: Record<string, unknown> = { userId: cuenta.id, nombre }
    // El propio administrador no puede cambiar su rol ni desactivarse.
    if (!esUnoMismo) {
      body.rol = rol
      body.clienteId = rol === "cliente" ? clienteId : null
      body.activo = activo
    }
    if (cambiarPass) body.password = password
    const res = await fetch("/api/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    setGuardando(false)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudieron guardar los cambios.")
      return
    }
    toast.success(activar && activo ? "Usuario activado." : "Usuario actualizado.")
    onClose()
    await onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{activar ? "Asignar rol y activar" : "Editar usuario"}</DialogTitle>
          <DialogDescription>{cuenta.email}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="editar-nombre">Nombre completo</FieldLabel>
            <Input
              id="editar-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="editar-rol">Rol</FieldLabel>
            <RolSelect
              id="editar-rol"
              value={rol}
              onChange={setRol}
              disabled={esUnoMismo}
            />
            {esUnoMismo && (
              <p className="text-xs text-muted-foreground">
                No puedes cambiar tu propio rol de administrador.
              </p>
            )}
          </Field>

          {rol === "cliente" && (
            <EmpresaSelect id="editar-empresa" value={clienteId} onChange={setClienteId} />
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="editar-activo">Cuenta activa</Label>
              <span className="text-xs text-muted-foreground">
                Si está inactiva, la persona no podrá usar el sistema.
              </span>
            </div>
            <Switch
              id="editar-activo"
              checked={activo}
              onCheckedChange={setActivo}
              disabled={esUnoMismo}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                <Label htmlFor="editar-cambiar-pass">Cambiar contraseña</Label>
              </div>
              <Switch
                id="editar-cambiar-pass"
                checked={cambiarPass}
                onCheckedChange={setCambiarPass}
              />
            </div>
            {cambiarPass && (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Input
                    type={verPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nueva contraseña"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                    aria-label={verPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {verPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Input
                  type={verPassword ? "text" : "password"}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Confirmar contraseña"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : activar ? "Activar" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

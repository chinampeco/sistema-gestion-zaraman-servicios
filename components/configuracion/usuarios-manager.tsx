"use client"

import * as React from "react"
import { Eye, EyeOff, KeyRound, MoreVertical, UserPlus } from "lucide-react"
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
  DropdownMenuSeparator,
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
import { iniciales } from "@/lib/format"
import { DESCRIPCION_ROL, puedeGestionarUsuarios } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { ROLES_USUARIO, type RolUsuario, type Usuario } from "@/lib/types"

const ROLES_INTERNOS = ROLES_USUARIO.filter((r) => r !== "Cliente") as RolUsuario[]

export function UsuariosManager() {
  const { usuarioActual, usuarios, recargar } = useStore()
  const esAdmin = puedeGestionarUsuarios(usuarioActual.rol)

  const [crearAbierto, setCrearAbierto] = React.useState(false)
  const [editar, setEditar] = React.useState<Usuario | null>(null)

  // Solo el personal interno se administra aquí; los clientes van en su ficha.
  const internos = usuarios.filter((u) => u.rol !== "Cliente")

  return (
    <div className="flex flex-col gap-4">
      {esAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setCrearAbierto(true)}>
            <UserPlus className="size-4" />
            Nuevo usuario
          </Button>
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
              {esAdmin && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {internos.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {iniciales(u.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{u.nombre}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {u.email}
                </TableCell>
                <TableCell>{u.rol}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={u.activo ? "success" : "secondary"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                {esAdmin && (
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
                        <DropdownMenuItem onClick={() => setEditar(u)}>
                          Editar usuario
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {internos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={esAdmin ? 5 : 4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No hay usuarios internos registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {esAdmin && (
        <CrearUsuarioDialog
          abierto={crearAbierto}
          onOpenChange={setCrearAbierto}
          onGuardado={recargar}
        />
      )}

      {esAdmin && editar && (
        <EditarUsuarioDialog
          usuario={editar}
          esUnoMismo={editar.id === usuarioActual.id}
          onClose={() => setEditar(null)}
          onGuardado={recargar}
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
    <Select value={value} onValueChange={(v) => onChange(v as RolUsuario)} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES_INTERNOS.map((r) => (
          <SelectItem key={r} value={r}>
            <div className="flex flex-col">
              <span>{r}</span>
              <span className="text-xs text-muted-foreground">
                {DESCRIPCION_ROL[r as keyof typeof DESCRIPCION_ROL]}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  const { tecnicos, usuarios } = useStore()
  const [nombre, setNombre] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [rol, setRol] = React.useState<RolUsuario>("Coordinador")
  const [tecnicoId, setTecnicoId] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)

  // Fichas de técnico que aún no tienen una cuenta de acceso vinculada.
  const tecnicosDisponibles = React.useMemo(() => {
    const vinculados = new Set(
      usuarios.map((u) => u.tecnicoId).filter((id): id is string => Boolean(id)),
    )
    return tecnicos.filter((t) => !vinculados.has(t.id))
  }, [tecnicos, usuarios])

  React.useEffect(() => {
    if (abierto) {
      setNombre("")
      setEmail("")
      setPassword("")
      setConfirmar("")
      setRol("Coordinador")
      setTecnicoId("")
      setVerPassword(false)
    }
  }, [abierto])

  async function guardar() {
    if (!nombre.trim() || !email.trim()) {
      toast.error("Completa el nombre y el correo.")
      return
    }
    if (rol === "Técnico" && !tecnicoId) {
      toast.error("Selecciona la ficha de técnico a la que se vincula la cuenta.")
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
      body: JSON.stringify({ nombre, email, password, rol, tecnicoId: tecnicoId || null }),
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
            Crea una cuenta con acceso al panel. Comparte estas credenciales con
            la persona; podrá iniciar sesión de inmediato.
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
          {rol === "Técnico" && (
            <Field>
              <FieldLabel htmlFor="nuevo-tecnico">Ficha de técnico vinculada</FieldLabel>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger id="nuevo-tecnico">
                  <SelectValue placeholder="Selecciona un técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicosDisponibles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tecnicosDisponibles.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay fichas de técnico libres. Crea una en el módulo Técnicos o
                  desvincula una cuenta existente.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  La cuenta solo verá las órdenes asignadas a esta ficha.
                </p>
              )}
            </Field>
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
  usuario,
  esUnoMismo,
  onClose,
  onGuardado,
}: {
  usuario: Usuario
  esUnoMismo: boolean
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const { tecnicos, usuarios } = useStore()
  const [nombre, setNombre] = React.useState(usuario.nombre)
  const [rol, setRol] = React.useState<RolUsuario>(usuario.rol)
  const [activo, setActivo] = React.useState(usuario.activo)
  const [tecnicoId, setTecnicoId] = React.useState(usuario.tecnicoId ?? "")
  const [guardando, setGuardando] = React.useState(false)

  // Fichas libres + la que ya tiene esta cuenta (para poder conservarla).
  const tecnicosDisponibles = React.useMemo(() => {
    const vinculados = new Set(
      usuarios
        .filter((u) => u.id !== usuario.id)
        .map((u) => u.tecnicoId)
        .filter((id): id is string => Boolean(id)),
    )
    return tecnicos.filter((t) => !vinculados.has(t.id))
  }, [tecnicos, usuarios, usuario.id])

  const [cambiarPass, setCambiarPass] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [confirmar, setConfirmar] = React.useState("")
  const [verPassword, setVerPassword] = React.useState(false)

  async function guardar() {
    if (rol === "Técnico" && !tecnicoId) {
      toast.error("Selecciona la ficha de técnico a la que se vincula la cuenta.")
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
    const body: Record<string, unknown> = {
      userId: usuario.id,
      nombre,
      rol,
      activo,
      tecnicoId: rol === "Técnico" ? tecnicoId || null : null,
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
    toast.success("Usuario actualizado.")
    onClose()
    await onGuardado()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>{usuario.email}</DialogDescription>
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

          {rol === "Técnico" && (
            <Field>
              <FieldLabel htmlFor="editar-tecnico">Ficha de técnico vinculada</FieldLabel>
              <Select value={tecnicoId} onValueChange={setTecnicoId}>
                <SelectTrigger id="editar-tecnico">
                  <SelectValue placeholder="Selecciona un técnico" />
                </SelectTrigger>
                <SelectContent>
                  {tecnicosDisponibles.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                La cuenta solo verá las órdenes asignadas a esta ficha.
              </p>
            </Field>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor="editar-activo">Cuenta activa</Label>
              <span className="text-xs text-muted-foreground">
                Si se desactiva, la persona no podrá usar el panel.
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
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

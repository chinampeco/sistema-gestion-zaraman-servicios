import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { ROLES_USUARIO } from "@/lib/types"
import type { RolUsuario } from "@/lib/types"

// Gestión de cuentas (solo Administrador). Usa service_role en el servidor
// porque profiles no guarda el correo (está en auth.users) y porque crear
// usuarios o cambiar contraseñas requiere la API de administración de Auth.

function esRol(rol: unknown): rol is RolUsuario {
  return typeof rol === "string" && (ROLES_USUARIO as string[]).includes(rol)
}

// Solo un Administrador autenticado y activo puede gestionar usuarios.
async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "No autenticado.", status: 401 as const, user: null }
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle()

  if (!perfil || perfil.role !== "administrador" || perfil.active !== true) {
    return {
      error: "Solo un administrador puede gestionar usuarios.",
      status: 403 as const,
      user: null,
    }
  }

  return { error: null, status: 200 as const, user }
}

function adminClient() {
  return createAdminClient(
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

type Admin = ReturnType<typeof adminClient>

// Un usuario cliente debe ligarse a una empresa existente; los demás roles no
// llevan empresa. Devuelve el cliente_id a guardar o un mensaje de error.
async function resolverClienteId(
  admin: Admin,
  rol: RolUsuario,
  clienteId: unknown,
): Promise<{ clienteId: string | null; error: string | null }> {
  if (rol !== "cliente") return { clienteId: null, error: null }
  if (typeof clienteId !== "string" || !clienteId) {
    return { clienteId: null, error: "Selecciona la empresa del usuario cliente." }
  }
  const { data: cliente } = await admin
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .maybeSingle()
  if (!cliente) {
    return { clienteId: null, error: "La empresa seleccionada no existe." }
  }
  return { clienteId: cliente.id, error: null }
}

// Listar todas las cuentas, incluidas las registradas pendientes de activar.
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const admin = adminClient()

  const { data: perfiles, error: perfilesError } = await admin
    .from("profiles")
    .select("id, full_name, role, active, cliente_id, created_at")
    .order("created_at", { ascending: false })

  if (perfilesError) {
    return NextResponse.json(
      { error: "No se pudieron cargar los usuarios." },
      { status: 500 },
    )
  }

  // Correo y confirmación desde auth.users (paginado).
  const cuentas = new Map<string, { email: string; confirmado: boolean }>()
  const porPagina = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: porPagina })
    if (error) {
      return NextResponse.json(
        { error: "No se pudieron cargar los correos de los usuarios." },
        { status: 500 },
      )
    }
    for (const u of data.users) {
      cuentas.set(u.id, { email: u.email ?? "", confirmado: Boolean(u.email_confirmed_at) })
    }
    if (data.users.length < porPagina) break
  }

  const usuarios = (perfiles ?? []).map((p) => {
    const cuenta = cuentas.get(p.id)
    return {
      id: p.id as string,
      nombre: (p.full_name as string | null) || cuenta?.email || "",
      email: cuenta?.email ?? "",
      rol: p.role as RolUsuario,
      activo: p.active === true,
      clienteId: (p.cliente_id as string | null) ?? null,
      createdAt: p.created_at as string,
      correoConfirmado: cuenta?.confirmado ?? false,
    }
  })

  return NextResponse.json({ usuarios })
}

// Crear una cuenta con rol asignado y activa.
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const nombre: string = (body?.nombre ?? "").trim()
  const email: string = (body?.email ?? "").trim().toLowerCase()
  const password: string = body?.password ?? ""
  const rol = body?.rol

  if (!nombre || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Datos incompletos. La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    )
  }

  if (!esRol(rol)) {
    return NextResponse.json({ error: "Rol no válido." }, { status: 400 })
  }

  const admin = adminClient()

  const vinculo = await resolverClienteId(admin, rol, body?.clienteId)
  if (vinculo.error) {
    return NextResponse.json({ error: vinculo.error }, { status: 400 })
  }

  // Los metadatos solo llevan el nombre: la base nunca toma el rol de ahí.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nombre },
  })

  if (createError || !created.user) {
    const message =
      createError?.message?.includes("already been registered") ||
      createError?.message?.includes("already exists")
        ? "Ya existe una cuenta con ese correo electrónico."
        : createError?.message ?? "No se pudo crear el usuario."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // El trigger on_auth_user_created crea el perfil inactivo con 'consulta';
  // aquí se fija el rol elegido y se activa (upsert por si el perfil no existe).
  const { error: perfilError } = await admin.from("profiles").upsert({
    id: created.user.id,
    full_name: nombre,
    role: rol,
    active: true,
    cliente_id: vinculo.clienteId,
  })

  if (perfilError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json(
      { error: "No se pudo configurar el perfil del usuario." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}

// Actualizar una cuenta: rol, empresa, estado, nombre o contraseña.
export async function PATCH(request: Request) {
  const auth = await requireAdmin()
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const userId: string | undefined = body?.userId
  const nuevoRol = body?.rol
  const activo: boolean | undefined =
    typeof body?.activo === "boolean" ? body.activo : undefined
  const nombre: string | undefined =
    typeof body?.nombre === "string" ? body.nombre.trim() : undefined
  const password: string | undefined =
    typeof body?.password === "string" ? body.password : undefined

  if (!userId) {
    return NextResponse.json({ error: "Falta el usuario." }, { status: 400 })
  }

  if (nuevoRol !== undefined && !esRol(nuevoRol)) {
    return NextResponse.json({ error: "Rol no válido." }, { status: 400 })
  }

  const admin = adminClient()

  const { data: objetivo } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle()

  if (!objetivo) {
    return NextResponse.json({ error: "El usuario no existe." }, { status: 404 })
  }

  const esUnoMismo = userId === auth.user.id

  // Evitar que el administrador se bloquee a sí mismo.
  if (esUnoMismo && nuevoRol !== undefined && nuevoRol !== "administrador") {
    return NextResponse.json(
      { error: "No puedes cambiar tu propio rol de administrador." },
      { status: 400 },
    )
  }
  if (esUnoMismo && activo === false) {
    return NextResponse.json(
      { error: "No puedes desactivar tu propia cuenta." },
      { status: 400 },
    )
  }

  if (password !== undefined && password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    )
  }

  // Cambios en el perfil. La empresa se recalcula con el rol final: si deja
  // de ser cliente se desliga; si es (o pasa a ser) cliente, debe tener una.
  const cambios: Record<string, unknown> = {}
  const rolFinal = (nuevoRol ?? objetivo.role) as RolUsuario
  if (nuevoRol !== undefined || body?.clienteId !== undefined) {
    const vinculo = await resolverClienteId(admin, rolFinal, body?.clienteId)
    if (vinculo.error) {
      return NextResponse.json({ error: vinculo.error }, { status: 400 })
    }
    cambios.role = rolFinal
    cambios.cliente_id = vinculo.clienteId
  }
  if (activo !== undefined) cambios.active = activo
  if (nombre !== undefined && nombre.length > 0) cambios.full_name = nombre

  if (Object.keys(cambios).length > 0) {
    const { error } = await admin.from("profiles").update(cambios).eq("id", userId)
    if (error) {
      return NextResponse.json(
        { error: "No se pudieron guardar los cambios." },
        { status: 500 },
      )
    }
  }

  // Cambiar contraseña.
  if (password !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la contraseña." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, userId })
}

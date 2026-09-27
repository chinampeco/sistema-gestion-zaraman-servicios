import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { ROLES_USUARIO } from "@/lib/types"
import type { RolUsuario } from "@/lib/types"

// Roles internos que se pueden asignar desde esta gestión.
const ROLES_INTERNOS = ROLES_USUARIO.filter((r) => r !== "Cliente")

function esRolInterno(rol: unknown): rol is RolUsuario {
  return typeof rol === "string" && (ROLES_INTERNOS as string[]).includes(rol)
}

// Solo un Administrador autenticado puede gestionar usuarios.
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
    .select("rol")
    .eq("id", user.id)
    .single()

  if (!perfil || perfil.rol !== "Administrador") {
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
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Crear un nuevo usuario interno con acceso al panel.
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
  const tecnicoId: string | null =
    typeof body?.tecnicoId === "string" && body.tecnicoId ? body.tecnicoId : null

  if (!nombre || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Datos incompletos. La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    )
  }

  if (!esRolInterno(rol)) {
    return NextResponse.json({ error: "Rol no válido." }, { status: 400 })
  }

  // Una cuenta de técnico debe estar vinculada a su ficha para poder aislar
  // sus órdenes; solo el rol Técnico puede llevar ese vínculo.
  if (rol === "Técnico" && !tecnicoId) {
    return NextResponse.json(
      { error: "Selecciona la ficha de técnico a la que se vincula esta cuenta." },
      { status: 400 },
    )
  }
  const tecnicoVinculo = rol === "Técnico" ? tecnicoId : null

  const admin = adminClient()

  if (tecnicoVinculo) {
    const { data: yaVinculada } = await admin
      .from("profiles")
      .select("id")
      .eq("tecnico_id", tecnicoVinculo)
      .maybeSingle()
    if (yaVinculada) {
      return NextResponse.json(
        { error: "Esa ficha de técnico ya tiene una cuenta de acceso." },
        { status: 400 },
      )
    }
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre_completo: nombre, rol },
  })

  if (createError || !created.user) {
    const message =
      createError?.message?.includes("already been registered") ||
      createError?.message?.includes("already exists")
        ? "Ya existe una cuenta con ese correo electrónico."
        : createError?.message ?? "No se pudo crear el usuario."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Asegurar rol y datos del perfil (el trigger crea el perfil base).
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      rol,
      nombre_completo: nombre,
      email,
      activo: true,
      cliente_id: null,
      tecnico_id: tecnicoVinculo,
    })
    .eq("id", created.user.id)

  if (updateError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json(
      { error: "No se pudo configurar el perfil del usuario." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}

// Actualizar un usuario interno: rol, estado, nombre o contraseña.
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

  const admin = adminClient()

  const { data: objetivo } = await admin
    .from("profiles")
    .select("id, rol")
    .eq("id", userId)
    .single()

  if (!objetivo) {
    return NextResponse.json({ error: "El usuario no existe." }, { status: 404 })
  }

  if (objetivo.rol === "Cliente") {
    return NextResponse.json(
      { error: "Los accesos de cliente se gestionan desde la ficha del cliente." },
      { status: 400 },
    )
  }

  const esUnoMismo = userId === auth.user.id

  // Evitar que el administrador se bloquee a sí mismo.
  if (esUnoMismo && nuevoRol !== undefined && nuevoRol !== "Administrador") {
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

  // Cambiar contraseña.
  if (password !== undefined) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 },
      )
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) {
      return NextResponse.json(
        { error: "No se pudo actualizar la contraseña." },
        { status: 500 },
      )
    }
  }

  const tecnicoId: string | null =
    typeof body?.tecnicoId === "string" && body.tecnicoId ? body.tecnicoId : null

  // Cambios en el perfil.
  const cambios: Record<string, unknown> = {}
  if (nuevoRol !== undefined) {
    if (!esRolInterno(nuevoRol)) {
      return NextResponse.json({ error: "Rol no válido." }, { status: 400 })
    }
    cambios.rol = nuevoRol
    // El vínculo con ficha de técnico solo aplica al rol Técnico.
    if (nuevoRol === "Técnico") {
      if (!tecnicoId) {
        return NextResponse.json(
          { error: "Selecciona la ficha de técnico a la que se vincula esta cuenta." },
          { status: 400 },
        )
      }
      const { data: yaVinculada } = await admin
        .from("profiles")
        .select("id")
        .eq("tecnico_id", tecnicoId)
        .neq("id", userId)
        .maybeSingle()
      if (yaVinculada) {
        return NextResponse.json(
          { error: "Esa ficha de técnico ya tiene una cuenta de acceso." },
          { status: 400 },
        )
      }
      cambios.tecnico_id = tecnicoId
    } else {
      cambios.tecnico_id = null
    }
  }
  if (activo !== undefined) cambios.activo = activo
  if (nombre !== undefined && nombre.length > 0) cambios.nombre_completo = nombre

  if (Object.keys(cambios).length > 0) {
    const { error } = await admin.from("profiles").update(cambios).eq("id", userId)
    if (error) {
      return NextResponse.json(
        { error: "No se pudieron guardar los cambios." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, userId })
}

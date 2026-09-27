import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"

const STAFF_ROLES = ["Administrador", "Coordinador", "Tecnico", "Técnico"]

async function requireStaff() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "No autenticado.", status: 401 as const, supabase: null }
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single()

  if (!perfil || !STAFF_ROLES.includes(perfil.rol)) {
    return {
      error: "No tienes permisos para gestionar accesos.",
      status: 403 as const,
      supabase: null,
    }
  }

  return { error: null, status: 200 as const, supabase }
}

function adminClient() {
  return createAdminClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Crear un nuevo acceso al portal para un cliente.
export async function POST(request: Request) {
  const auth = await requireStaff()
  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const supabase = auth.supabase

  const body = await request.json().catch(() => null)
  const clienteId: string | undefined = body?.clienteId
  const nombre: string = (body?.nombre ?? "").trim()
  const email: string = (body?.email ?? "").trim().toLowerCase()
  const password: string = body?.password ?? ""

  if (!clienteId || !email || password.length < 6) {
    return NextResponse.json(
      { error: "Datos incompletos. La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    )
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("id", clienteId)
    .single()

  if (!cliente) {
    return NextResponse.json({ error: "El cliente no existe." }, { status: 404 })
  }

  const admin = adminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre_completo: nombre || cliente.nombre,
      rol: "Cliente",
    },
  })

  if (createError || !created.user) {
    const message =
      createError?.message?.includes("already been registered") ||
      createError?.message?.includes("already exists")
        ? "Ya existe una cuenta con ese correo electrónico."
        : createError?.message ?? "No se pudo crear el acceso."
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      rol: "Cliente",
      cliente_id: clienteId,
      nombre_completo: nombre || cliente.nombre,
    })
    .eq("id", created.user.id)

  if (updateError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return NextResponse.json(
      { error: "No se pudo vincular la cuenta con el cliente." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, userId: created.user.id })
}

// Restablecer la contraseña de un acceso existente.
export async function PATCH(request: Request) {
  const auth = await requireStaff()
  if (auth.error || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const supabase = auth.supabase

  const body = await request.json().catch(() => null)
  const clienteId: string | undefined = body?.clienteId
  const password: string = body?.password ?? ""

  if (!clienteId || password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres." },
      { status: 400 },
    )
  }

  // Buscar la cuenta de portal ligada a este cliente.
  const { data: perfilCliente } = await supabase
    .from("profiles")
    .select("id, cliente_id, rol")
    .eq("cliente_id", clienteId)
    .eq("rol", "Cliente")
    .maybeSingle()

  if (!perfilCliente) {
    return NextResponse.json(
      { error: "Este cliente no tiene un acceso al portal." },
      { status: 404 },
    )
  }

  const admin = adminClient()

  const { error: updateError } = await admin.auth.admin.updateUserById(perfilCliente.id, {
    password,
  })

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo actualizar la contraseña." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, userId: perfilCliente.id })
}

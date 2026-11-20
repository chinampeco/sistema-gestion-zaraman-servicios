import { NextResponse } from "next/server"

import { adminClient } from "@/lib/importacion-servidor"
import { createClient } from "@/lib/supabase/server"

// Contraseñas demasiado comunes que no se aceptan (además del mínimo de 8 caracteres).
const DEBILES = new Set(["12345678", "123456789", "1234567890", "password", "contraseña", "qwerty123", "11111111", "00000000"])

// El usuario en sesión cambia su contraseña; se quita la marca de cambio obligatorio.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const password: string = typeof body?.password === "string" ? body.password : ""
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 })
  }
  if (DEBILES.has(password.toLowerCase()) || /^(.)\1+$/.test(password)) {
    return NextResponse.json({ error: "Esa contraseña es muy fácil de adivinar. Elige otra." }, { status: 400 })
  }
  if (user.email && password.toLowerCase().includes(user.email.split("@")[0].toLowerCase())) {
    return NextResponse.json({ error: "La contraseña no debe contener tu correo." }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password })
  if (error) {
    const mensaje = /weak|pwned|leaked/i.test(error.message)
      ? "Esa contraseña aparece en filtraciones conocidas. Elige otra."
      : "No se pudo cambiar la contraseña."
    return NextResponse.json({ error: mensaje }, { status: 400 })
  }
  await admin.from("profiles").update({ debe_cambiar_password: false }).eq("id", user.id)
  return NextResponse.json({ ok: true })
}

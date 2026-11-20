import { NextResponse } from "next/server"

import { MAX_INTENTOS, MINUTOS_BLOQUEO, correoBloqueado, registrarAcceso } from "@/lib/bitacora"
import { createClient } from "@/lib/supabase/server"

// Inicio de sesión desde el servidor para dejar constancia en la bitácora
// (también de los intentos fallidos) y bloquear un rato tras varios fallos.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!email || !password) {
    return NextResponse.json({ error: "Escribe tu correo y contraseña." }, { status: 400 })
  }

  if (await correoBloqueado(email)) {
    await registrarAcceso(request.headers, { evento: "Bloqueo temporal", exito: false, email })
    return NextResponse.json(
      {
        error: `Demasiados intentos fallidos con este correo. Por seguridad espera ${MINUTOS_BLOQUEO} minutos e intenta de nuevo.`,
      },
      { status: 429 },
    )
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    const sinConfirmar = !!error?.message.toLowerCase().includes("email not confirmed")
    await registrarAcceso(request.headers, {
      evento: "Inicio de sesión",
      exito: false,
      email,
      detalle: sinConfirmar ? "Correo sin confirmar" : "Correo o contraseña incorrectos",
    })
    return NextResponse.json(
      {
        error: sinConfirmar
          ? "Debes confirmar tu correo antes de iniciar sesión."
          : `Correo o contraseña incorrectos. Tras ${MAX_INTENTOS} intentos fallidos el acceso se bloquea ${MINUTOS_BLOQUEO} minutos.`,
      },
      { status: 401 },
    )
  }

  await registrarAcceso(request.headers, { evento: "Inicio de sesión", usuarioId: data.user.id, email })
  return NextResponse.json({ ok: true })
}

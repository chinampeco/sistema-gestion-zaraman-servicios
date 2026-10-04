import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { RolUsuario } from "@/lib/types"
import { RUTA_CUENTA_PENDIENTE, puedeAccederRuta, rutaInicioRol } from "@/lib/permisos"

// Las rutas /api gestionan su propia autenticación y responden JSON (incluidos
// 401/403). No deben pasar por el guard de redirección: si se redirigen,
// el endpoint nunca se ejecuta y el cliente recibe HTML en vez de su respuesta.
const PUBLIC_PATHS = ["/auth", "/_next", "/favicon.ico", "/api"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Do not run code between createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    return NextResponse.redirect(url)
  }

  // Control de acceso por rol para usuarios autenticados en rutas internas.
  if (user && !isPublic) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle()

    const rol = perfil?.role as RolUsuario | undefined

    // Sin perfil, inactivo o cliente (el portal aún no está disponible):
    // ninguna ruta interna; solo la pantalla de cuenta pendiente.
    if (!perfil || !rol || perfil.active !== true || rol === "cliente") {
      const url = request.nextUrl.clone()
      url.pathname = RUTA_CUENTA_PENDIENTE
      url.search = ""
      return NextResponse.redirect(url)
    }

    // El personal no entra al portal y solo ve los módulos de su rol.
    const enPortal = pathname === "/portal" || pathname.startsWith("/portal/")
    if (enPortal || !puedeAccederRuta(rol, pathname)) {
      const destino = rutaInicioRol(rol)
      if (pathname !== destino) {
        const url = request.nextUrl.clone()
        url.pathname = destino
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

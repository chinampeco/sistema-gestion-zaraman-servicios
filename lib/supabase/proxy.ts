import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { RolUsuario } from "@/lib/types"
import { puedeAccederRuta, rutaInicioRol } from "@/lib/permisos"

// Las rutas /api gestionan su propia autenticación y responden JSON (incluidos
// 401/403). No deben pasar por el guard de redirección: si se redirigen,
// el endpoint nunca se ejecuta y el cliente recibe HTML en vez de su respuesta.
const PUBLIC_PATHS = ["/auth", "/_next", "/favicon.ico", "/api"]

// Pantalla para elegir con qué empresa trabajar (después de iniciar sesión).
export const RUTA_SELECTOR_EMPRESA = "/seleccionar-empresa"

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
    // empresa_activa() solo devuelve una empresa a la que el usuario sigue teniendo acceso.
    const [{ data: perfil }, { data: empresaActiva }] = await Promise.all([
      supabase.from("profiles").select("rol").eq("id", user.id).single(),
      supabase.rpc("empresa_activa"),
    ])

    const rol = perfil?.rol as RolUsuario | undefined

    if (rol) {
      const enPortal = pathname === "/portal" || pathname.startsWith("/portal/")

      if (rol === "Cliente") {
        // El cliente solo puede estar dentro del portal.
        if (!enPortal) {
          const url = request.nextUrl.clone()
          url.pathname = "/portal"
          return NextResponse.redirect(url)
        }
      } else if (pathname === RUTA_SELECTOR_EMPRESA) {
        // El selector de empresa es accesible para todo el personal.
      } else if (!empresaActiva) {
        // Sin empresa elegida (o sin acceso a la que tenía): primero elegir empresa.
        const url = request.nextUrl.clone()
        url.pathname = RUTA_SELECTOR_EMPRESA
        return NextResponse.redirect(url)
      } else {
        // El personal no entra al portal y solo ve los módulos de su rol.
        if (enPortal || !puedeAccederRuta(rol, pathname)) {
          const destino = rutaInicioRol(rol)
          if (pathname !== destino) {
            const url = request.nextUrl.clone()
            url.pathname = destino
            return NextResponse.redirect(url)
          }
        }
      }
    }
  }

  return supabaseResponse
}

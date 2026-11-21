import { NextResponse } from "next/server"

import { sesionVerificada } from "@/lib/dos-pasos"
import { adminClient } from "@/lib/importacion-servidor"
import { createClient } from "@/lib/supabase/server"

// Respaldo completo para el Administrador verificado. El navegador pide:
//   GET /api/respaldo                      → índice: tablas y archivos (con enlaces temporales)
//   GET /api/respaldo?tabla=x&desde=0      → un bloque de filas de esa tabla
// y arma el ZIP en el equipo del administrador (así no hay límite de tamaño del servidor).

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES_BLOQUE = 3_000_000 // la respuesta de una función de Vercel no puede pasar de ~4.5 MB
const FILAS_POR_BLOQUE = 500

async function requerirAdminVerificado() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: "No autenticado." }
  const { data: perfil } = await supabase.from("profiles").select("rol, activo").eq("id", user.id).single()
  if (!perfil || perfil.rol !== "Administrador" || !perfil.activo) {
    return { ok: false as const, status: 403, error: "Solo un administrador puede descargar el respaldo." }
  }
  if (!(await sesionVerificada(supabase))) {
    return { ok: false as const, status: 403, error: "Primero completa la verificación en dos pasos." }
  }
  return { ok: true as const }
}

interface Tabla {
  nombre: string
  orden: string | null
}

/** Todas las tablas del esquema public (las nuevas entran solas al respaldo). */
async function tablas(admin: ReturnType<typeof adminClient>): Promise<Tabla[]> {
  const { data, error } = await admin.rpc("tablas_respaldo")
  if (error) throw new Error("No se pudo leer la lista de tablas.")
  return ((data ?? []) as { nombre: string; llave: string | null }[]).map((t) => ({ nombre: t.nombre, orden: t.llave }))
}

interface Archivo {
  bucket: string
  ruta: string
  tamano: number
}

async function listarCarpeta(admin: ReturnType<typeof adminClient>, bucket: string, carpeta: string, salida: Archivo[]) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(carpeta, { limit: 1000, offset })
    if (error) throw new Error(`No se pudo listar ${bucket}/${carpeta}`)
    for (const o of data ?? []) {
      const ruta = carpeta ? `${carpeta}/${o.name}` : o.name
      if (o.id === null) await listarCarpeta(admin, bucket, ruta, salida) // es carpeta
      else salida.push({ bucket, ruta, tamano: Number((o.metadata as { size?: number } | null)?.size ?? 0) })
    }
    if (!data || data.length < 1000) break
  }
}

export async function GET(request: Request) {
  const acceso = await requerirAdminVerificado()
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status })

  const admin = adminClient()
  const url = new URL(request.url)
  const tabla = url.searchParams.get("tabla")

  try {
    const lista = await tablas(admin)

    if (!tabla) {
      const { data: buckets } = await admin.storage.listBuckets()
      const archivos: Archivo[] = []
      for (const b of buckets ?? []) await listarCarpeta(admin, b.id, "", archivos)
      const enlaces: (Archivo & { url: string })[] = []
      for (const b of new Set(archivos.map((a) => a.bucket))) {
        const delBucket = archivos.filter((a) => a.bucket === b)
        for (let i = 0; i < delBucket.length; i += 100) {
          const grupo = delBucket.slice(i, i + 100)
          const { data } = await admin.storage.from(b).createSignedUrls(grupo.map((a) => a.ruta), 3600)
          const porRuta = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
          for (const a of grupo) enlaces.push({ ...a, url: porRuta.get(a.ruta) ?? "" })
        }
      }
      return NextResponse.json({
        generado: new Date().toISOString(),
        tablas: lista.map((t) => t.nombre),
        archivos: enlaces,
      })
    }

    const def = lista.find((t) => t.nombre === tabla)
    if (!def) return NextResponse.json({ error: "Tabla no válida." }, { status: 400 })
    const desde = Math.max(0, Number(url.searchParams.get("desde")) || 0)

    let q = admin.from(def.nombre).select("*").range(desde, desde + FILAS_POR_BLOQUE - 1)
    if (def.orden) q = q.order(def.orden, { ascending: true })
    const { data, error } = await q
    if (error) return NextResponse.json({ error: `No se pudo leer ${tabla}.` }, { status: 500 })

    // Si el bloque pesa demasiado (firmas o documentos en la fila), se manda menos filas.
    let filas = (data ?? []) as unknown[]
    const completo = filas.length < FILAS_POR_BLOQUE
    let texto = JSON.stringify(filas)
    while (texto.length > MAX_BYTES_BLOQUE && filas.length > 1) {
      filas = filas.slice(0, Math.ceil(filas.length / 2))
      texto = JSON.stringify(filas)
    }
    const recortado = filas.length < (data ?? []).length
    return new NextResponse(
      JSON.stringify({ filas, siguiente: desde + filas.length, fin: completo && !recortado }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    )
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo preparar el respaldo." }, { status: 500 })
  }
}

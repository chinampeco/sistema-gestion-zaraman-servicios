import { NextResponse } from "next/server"

import { BUCKET_EXPEDIENTES } from "@/lib/contratos"
import { adminClient, esUuid, requerirGestor } from "@/lib/importacion-servidor"
import { createClient } from "@/lib/supabase/server"

const normalizar = (s: string) =>
  s.toLocaleLowerCase("es-MX").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()

// Expediente compartido: el perfil y los documentos de un técnico se copian a
// su ficha con el mismo nombre en las demás empresas a las que el usuario tiene
// acceso, para no subirlos en cada empresa.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirGestor()
  if (!sesion.ok) return NextResponse.json({ error: sesion.error }, { status: sesion.status })
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: "Técnico inválido." }, { status: 400 })

  // Origen visible para el usuario (RLS) y empresas a las que tiene acceso.
  const supabase = await createClient()
  const [{ data: origen }, { data: empresasUsuario }] = await Promise.all([
    supabase.from("tecnicos").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("empresas_del_usuario"),
  ])
  if (!origen) return NextResponse.json({ error: "El técnico no existe o no tienes acceso." }, { status: 404 })
  const otras = ((empresasUsuario as string[] | null) ?? []).filter((e) => e !== origen.empresa_id)
  if (otras.length === 0) return NextResponse.json({ ok: true, copias: [] })

  const admin = adminClient()
  const { data: candidatos } = await admin.from("tecnicos").select("id, nombre, empresa_id").in("empresa_id", otras)
  const destinos = (candidatos ?? []).filter((t) => normalizar(t.nombre) === normalizar(origen.nombre))
  if (destinos.length === 0) return NextResponse.json({ ok: true, copias: [] })

  const { data: docs } = await admin.from("tecnico_documentos").select("*").eq("tecnico_id", origen.id)
  const { data: emps } = await admin.from("empresas").select("id, clave").in("id", destinos.map((d) => d.empresa_id))
  const copias: string[] = []

  for (const destino of destinos) {
    // Perfil, lugar de origen y regiones (solo si el origen ya tiene perfil).
    if (origen.perfil_actualizado_at) {
      await admin
        .from("tecnicos")
        .update({
          perfil: origen.perfil,
          lugar_origen: origen.lugar_origen,
          regiones_trabajo: origen.regiones_trabajo,
          perfil_actualizado_at: origen.perfil_actualizado_at,
        })
        .eq("id", destino.id)
    }
    // Documentos que la ficha destino aún no tiene (mismo tipo y archivo).
    const { data: yaTiene } = await admin.from("tecnico_documentos").select("tipo, nombre_archivo").eq("tecnico_id", destino.id)
    const existentes = new Set((yaTiene ?? []).map((d) => `${d.tipo}|${d.nombre_archivo}`))
    let nuevos = 0
    for (const d of docs ?? []) {
      if (existentes.has(`${d.tipo}|${d.nombre_archivo}`)) continue
      const archivo = d.storage_path.split("/").pop()
      const ruta = `${destino.empresa_id}/tecnicos/${destino.id}/${archivo}`
      const { error: errCopia } = await admin.storage.from(BUCKET_EXPEDIENTES).copy(d.storage_path, ruta)
      if (errCopia) continue
      const { error } = await admin.from("tecnico_documentos").insert({
        tecnico_id: destino.id,
        tipo: d.tipo,
        descripcion: d.descripcion,
        nombre_archivo: d.nombre_archivo,
        storage_path: ruta,
        mime_type: d.mime_type,
        tamano_bytes: d.tamano_bytes,
        fecha_emision: d.fecha_emision,
        vigente_hasta: d.vigente_hasta,
        notas: d.notas,
        subido_por: sesion.userId,
      })
      if (error) await admin.storage.from(BUCKET_EXPEDIENTES).remove([ruta])
      else nuevos++
    }
    const clave = emps?.find((e) => e.id === destino.empresa_id)?.clave ?? "otra empresa"
    copias.push(`${clave}: ${origen.perfil_actualizado_at ? "perfil" : ""}${origen.perfil_actualizado_at && nuevos ? " y " : ""}${nuevos ? `${nuevos} documento(s)` : ""}`.replace(/: $/, ": al día"))
  }
  return NextResponse.json({ ok: true, copias })
}

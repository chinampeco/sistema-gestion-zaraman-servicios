import { redirect } from "next/navigation"

import { SelectorEmpresa } from "@/components/empresas/selector-empresa"
import { mapEmpresa } from "@/lib/mappers"
import { createClient } from "@/lib/supabase/server"

// Paso posterior al inicio de sesión: el personal elige con qué empresa trabajar.
// Con una sola empresa disponible se entra directo.
export default async function SeleccionarEmpresaPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol, nombre_completo")
    .eq("id", user.id)
    .single()
  // Los clientes no eligen empresa: entran al portal de la empresa de su ficha.
  if (perfil?.rol === "Cliente") redirect("/portal")

  const [{ data: acceso }, { data: filas }, { data: activa }] = await Promise.all([
    supabase.rpc("empresas_del_usuario"),
    supabase.from("empresas").select("*").eq("activa", true).order("nombre_comercial"),
    supabase.rpc("empresa_activa"),
  ])

  const ids = new Set(Array.isArray(acceso) ? (acceso as string[]) : [])
  const empresas = (filas ?? []).map(mapEmpresa).filter((e) => ids.has(e.id))

  if (empresas.length === 1) {
    const { error } = await supabase.rpc("seleccionar_empresa", { p_empresa_id: empresas[0].id })
    if (!error) redirect("/")
  }

  return (
    <SelectorEmpresa
      empresas={empresas}
      empresaActivaId={(activa as string | null) ?? null}
      nombreUsuario={perfil?.nombre_completo ?? user.email ?? ""}
    />
  )
}

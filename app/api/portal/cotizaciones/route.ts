import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { siguienteFolio, hoyISO } from "@/lib/format"
import type { HistorialCotizacion } from "@/lib/types"

// Acciones que el cliente del portal puede ejecutar sobre SU cotización.
type Accion = "marcar-vista" | "aceptar" | "rechazar"
const ACCIONES: Accion[] = ["marcar-vista", "aceptar", "rechazar"]

// Estados desde los que una cotización puede aceptarse o rechazarse.
const ESTADOS_DECIDIBLES = ["Enviada", "Vista"]

function adminClient() {
  return createAdminClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function esAccion(v: unknown): v is Accion {
  return typeof v === "string" && (ACCIONES as string[]).includes(v)
}

export async function POST(request: Request) {
  // 1) Autenticación: debe haber sesión y ser un usuario de tipo Cliente.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 })
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol, cliente_id, nombre_completo")
    .eq("id", user.id)
    .single()

  if (!perfil || perfil.rol !== "Cliente" || !perfil.cliente_id) {
    return NextResponse.json(
      { error: "Solo un cliente puede responder cotizaciones." },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)
  const cotizacionId: string = (body?.cotizacionId ?? "").trim()
  const accion = body?.accion
  if (!cotizacionId || !esAccion(accion)) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  }

  const admin = adminClient()

  // 2) Cargar la cotización y verificar que pertenece a este cliente.
  const { data: cot, error: cotError } = await admin
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacionId)
    .single()

  if (cotError || !cot) {
    return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 })
  }
  if (cot.cliente_id !== perfil.cliente_id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 })
  }

  const usuario: string = perfil.nombre_completo || user.email || "Cliente"
  const ahora = new Date().toISOString()
  const historial: HistorialCotizacion[] = Array.isArray(cot.historial)
    ? cot.historial
    : []

  // ---- marcar-vista: primera apertura de una cotización enviada ------------
  if (accion === "marcar-vista") {
    if (cot.estado !== "Enviada") {
      // Ya fue vista/decidida: no hay nada que registrar.
      return NextResponse.json({ ok: true, sinCambios: true })
    }
    const { error } = await admin
      .from("cotizaciones")
      .update({
        estado: "Vista",
        historial: [...historial, { evento: "Vista", fecha: ahora, usuario }],
      })
      .eq("id", cotizacionId)
    if (error) {
      return NextResponse.json({ error: "No se pudo registrar la vista." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ---- aceptar / rechazar --------------------------------------------------
  // Idempotencia: si ya fue decidida, devolvemos el estado actual sin duplicar.
  if (cot.estado === "Aceptada" || cot.estado === "Convertida") {
    return NextResponse.json({ ok: true, sinCambios: true, estado: cot.estado })
  }
  if (cot.estado === "Rechazada") {
    return NextResponse.json({ ok: true, sinCambios: true, estado: cot.estado })
  }
  if (!ESTADOS_DECIDIBLES.includes(cot.estado)) {
    return NextResponse.json(
      { error: `Una cotización en estado "${cot.estado}" no puede responderse.` },
      { status: 409 },
    )
  }

  if (accion === "rechazar") {
    const motivo: string = (body?.motivo ?? "").toString().trim()
    const eventoRechazo = motivo ? `Rechazada: ${motivo}` : "Rechazada"
    const { error } = await admin
      .from("cotizaciones")
      .update({
        estado: "Rechazada",
        rechazada_en: ahora,
        rechazada_por: user.id,
        motivo_rechazo: motivo || null,
        historial: [...historial, { evento: eventoRechazo, fecha: ahora, usuario }],
      })
      .eq("id", cotizacionId)
    if (error) {
      return NextResponse.json({ error: "No se pudo rechazar la cotización." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, estado: "Rechazada" })
  }

  // accion === "aceptar": marca la cotización y genera la orden de servicio
  // en estado "Pendiente de asignación" (sin técnico). El vínculo 1→1 se
  // garantiza con el índice único cotizaciones.orden_id.
  if (cot.orden_id) {
    // Ya tiene orden: solo aseguramos el estado aceptado.
    await admin
      .from("cotizaciones")
      .update({
        estado: cot.estado === "Enviada" || cot.estado === "Vista" ? "Aceptada" : cot.estado,
      })
      .eq("id", cotizacionId)
    return NextResponse.json({ ok: true, sinCambios: true, ordenId: cot.orden_id })
  }

  // Folio de la nueva orden a partir de los existentes.
  const { data: foliosRows } = await admin
    .from("ordenes_servicio")
    .select("folio")
  const folios = (foliosRows ?? []).map((r: { folio: string }) => r.folio)
  const folio = siguienteFolio(folios)

  const conceptos = Array.isArray(cot.conceptos) ? cot.conceptos : []
  const materiales = conceptos
    .map((c: { cantidad?: number; descripcion?: string; tipo?: string }) =>
      `${c.cantidad ?? 0} x ${c.descripcion ?? ""} (${c.tipo ?? ""})`,
    )
    .join("\n")

  const { data: ordenRow, error: ordenError } = await admin
    .from("ordenes_servicio")
    .insert({
      folio,
      cliente_id: cot.cliente_id,
      equipo_id: cot.equipo_id ?? null,
      cotizacion_id: cot.id,
      fecha_solicitud: hoyISO(),
      tipo_servicio: "Correctivo",
      prioridad: "Normal",
      estado: "Pendiente de asignación",
      descripcion_falla: `Generada desde cotización ${cot.folio} aceptada por el cliente.`,
      materiales,
      observaciones: cot.observaciones ?? "",
      creado_por: user.id,
      tecnico_id: null,
      historial: [
        {
          estado: "Pendiente de asignación",
          fecha: ahora,
          usuarioId: user.id,
          usuarioNombre: usuario,
        },
      ],
      materiales_detalle: [],
      evidencias: [],
    })
    .select("id, folio")
    .single()

  if (ordenError || !ordenRow) {
    return NextResponse.json(
      { error: "No se pudo generar la orden de servicio." },
      { status: 500 },
    )
  }

  const { error: cotUpdErr } = await admin
    .from("cotizaciones")
    .update({
      estado: "Aceptada",
      aceptada_en: ahora,
      aceptada_por: user.id,
      orden_id: ordenRow.id,
      historial: [...historial, { evento: "Aceptada", fecha: ahora, usuario }],
    })
    .eq("id", cotizacionId)

  if (cotUpdErr) {
    // Revertir la orden para no dejar registros huérfanos.
    await admin.from("ordenes_servicio").delete().eq("id", ordenRow.id)
    return NextResponse.json(
      { error: "No se pudo actualizar la cotización." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    estado: "Aceptada",
    ordenId: ordenRow.id,
    ordenFolio: ordenRow.folio,
  })
}

import { hoyISO } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { mapOrden, ordenToDb } from "@/lib/mappers"
import type { OrdenServicio, Ticket } from "@/lib/types"

export interface ResultadoConversionTicket {
  orden: OrdenServicio
  esGarantia: boolean
  ordenOrigenId: string | null
}

/**
 * Busca una garantía vigente para el mismo cliente/equipo del ticket.
 * La garantía se toma de una orden anterior y nunca modifica esa orden.
 */
export async function buscarGarantiaVigenteTicket(ticket: Ticket) {
  if (!ticket.equipoId) return null

  const supabase = createClient()
  const { data: ordenes, error: ordenesError } = await supabase
    .from("ordenes_servicio")
    .select("id, folio, cliente_id, equipo_id")
    .eq("cliente_id", ticket.clienteId)
    .eq("equipo_id", ticket.equipoId)
    .order("fecha_cierre", { ascending: false, nullsFirst: false })
    .limit(30)

  if (ordenesError || !ordenes?.length) return null

  const ids = ordenes.map((o) => o.id)
  const { data: garantias, error } = await supabase
    .from("orden_garantias")
    .select("*")
    .in("orden_id", ids)
    .eq("tiene_garantia", true)
    .gte("fecha_fin", hoyISO())
    .order("fecha_fin", { ascending: false })
    .limit(1)

  if (error || !garantias?.length) return null
  return garantias[0]
}

export async function convertirTicketEnOrdenDirecta(
  ticket: Ticket,
  usuarioId: string,
): Promise<ResultadoConversionTicket | null> {
  const supabase = createClient()

  if (ticket.ordenId) return null

  const garantia = await buscarGarantiaVigenteTicket(ticket)
  const esGarantia = Boolean(garantia)
  const hoy = hoyISO()
  const garantiaDias = garantia?.fecha_inicio && garantia?.fecha_fin
    ? Math.max(
        0,
        Math.round(
          (new Date(`${garantia.fecha_fin}T00:00:00`).getTime() -
            new Date(`${garantia.fecha_inicio}T00:00:00`).getTime()) /
            86400000,
        ),
      )
    : 0

  const payload = {
    ...ordenToDb({
      clienteId: ticket.clienteId,
      equipoId: ticket.equipoId ?? "",
      tecnicoId: null,
      fechaSolicitud: ticket.fechaSolicitud || hoy,
      fechaProgramada: null,
      fechaInicio: null,
      fechaCierre: null,
      tipoServicio: ticket.tipoServicio,
      prioridad: ticket.prioridad === "Baja" ? "Normal" : ticket.prioridad,
      estado: "Pendiente de asignación",
      descripcionFalla: ticket.descripcionFalla,
      diagnostico: "",
      trabajoRealizado: "",
      materiales: "",
      materialesDetalle: [],
      evidencias: [],
      horasTrabajadas: null,
      observaciones: esGarantia
        ? `Generada desde ${ticket.folio}. ATENCIÓN POR GARANTÍA. Orden original: ${garantia.orden_id}. No modifica la orden original.`
        : `Generada desde ${ticket.folio}. Servicio directo autorizado por operación; no se generó cotización. El servicio podrá generar cargos al cliente según el trabajo y materiales registrados.`,
      firmaCliente: "",
      firmaFecha: null,
      cerradaPor: null,
      creadoPor: usuarioId,
      ticketId: ticket.id,
      historial: [],
    }),
    es_garantia: esGarantia,
    orden_origen_id: esGarantia ? garantia.orden_id : null,
    motivo_garantia: esGarantia ? ticket.descripcionFalla : null,
    garantia_dias: esGarantia ? garantiaDias : 0,
    garantia_inicio: esGarantia ? garantia.fecha_inicio : null,
    garantia_fin: esGarantia ? garantia.fecha_fin : null,
  }

  const { data: row, error } = await supabase
    .from("ordenes_servicio")
    .insert(payload)
    .select("*")
    .single()

  if (error || !row) {
    console.error("[ticket-conversion] No se pudo crear la orden:", error?.message)
    return null
  }

  const nueva = mapOrden(row)

  if (esGarantia) {
    const { error: garantiaError } = await supabase.from("orden_garantias").upsert(
      {
        orden_id: nueva.id,
        orden_origen_id: garantia.orden_id,
        tiene_garantia: true,
        duracion_valor: garantia.duracion_valor,
        duracion_unidad: garantia.duracion_unidad,
        fecha_inicio: garantia.fecha_inicio,
        fecha_fin: garantia.fecha_fin,
        cobertura: garantia.cobertura,
        condiciones: garantia.condiciones,
        resultado: "Aprobada",
        gastos: [],
      },
      { onConflict: "orden_id" },
    )

    if (garantiaError) {
      console.warn("[ticket-conversion] La orden se creó, pero no se pudo enlazar la garantía:", garantiaError.message)
    }
  }

  const { error: ticketError } = await supabase
    .from("tickets")
    .update({ orden_id: nueva.id, estado: "En atención" })
    .eq("id", ticket.id)

  if (ticketError) {
    console.warn("[ticket-conversion] La orden se creó, pero no se pudo actualizar el ticket:", ticketError.message)
  }

  return {
    orden: nueva,
    esGarantia,
    ordenOrigenId: esGarantia ? garantia.orden_id : null,
  }
}

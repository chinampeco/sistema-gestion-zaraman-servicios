"use client"

// Store de datos de ZARAMAN SERVICIOS respaldado por Supabase.
// La lectura inicial y todas las mutaciones pasan por este contexto para que
// las pantallas no conozcan detalles del cliente de Supabase ni del esquema.

import * as React from "react"
import { toast } from "sonner"

import { createClient } from "@/lib/supabase/client"
import {
  campanaToDb,
  clienteToDb,
  cotizacionToDb,
  equipoToDb,
  facturaToDb,
  leadActividadToDb,
  leadToDb,
  mapCampana,
  mapCliente,
  mapCotizacion,
  mapEquipo,
  mapFactura,
  mapLead,
  mapLeadActividad,
  mapMensajeWhatsApp,
  mapOrden,
  mapPago,
  mapTecnico,
  mapTicket,
  mapUsuario,
  mensajeWhatsAppToDb,
  ordenToDb,
  pagoToDb,
  tecnicoToDb,
  ticketToDb,
} from "@/lib/mappers"
import type {
  Cliente,
  Cotizacion,
  Equipo,
  Factura,
  Lead,
  LeadActividad,
  MarketingCampana,
  MensajeWhatsApp,
  OrdenServicio,
  Pago,
  Tecnico,
  Ticket,
  Usuario,
} from "@/lib/types"

const USUARIO_PLACEHOLDER: Usuario = {
  id: "",
  nombre: "Cargando…",
  email: "",
  rol: "Coordinador",
  activo: true,
  clienteId: null,
  tecnicoId: null,
}

interface StoreContextValue {
  clientes: Cliente[]
  equipos: Equipo[]
  ordenes: OrdenServicio[]
  tickets: Ticket[]
  cotizaciones: Cotizacion[]
  facturas: Factura[]
  pagos: Pago[]
  tecnicos: Tecnico[]
  campanas: MarketingCampana[]
  leads: Lead[]
  leadActividades: LeadActividad[]
  mensajesWhatsApp: MensajeWhatsApp[]
  usuarios: Usuario[]
  usuarioActual: Usuario
  cargando: boolean
  recargar: () => Promise<void>

  crearCliente: (data: Omit<Cliente, "id" | "createdAt">) => Promise<Cliente | null>
  actualizarCliente: (id: string, data: Partial<Cliente>) => Promise<void>
  eliminarCliente: (id: string) => Promise<boolean>

  crearEquipo: (data: Omit<Equipo, "id">) => Promise<Equipo | null>
  actualizarEquipo: (id: string, data: Partial<Equipo>) => Promise<void>
  eliminarEquipo: (id: string) => Promise<boolean>

  crearOrden: (data: Omit<OrdenServicio, "id" | "folio">) => Promise<OrdenServicio | null>
  actualizarOrden: (id: string, data: Partial<OrdenServicio>) => Promise<void>
  asignarOrdenConGarantia: (
    ordenId: string,
    tecnicoId: string,
    historial: OrdenServicio["historial"],
    garantia: {
      ordenOrigenId: string | null
      tieneGarantia: boolean
      duracionValor: number | null
      duracionUnidad: "Días" | "Meses" | "Años"
      cobertura: string
      condiciones: string
      resultado: string
    },
  ) => Promise<OrdenServicio | null>
  eliminarOrden: (id: string) => Promise<boolean>

  crearTicket: (data: Omit<Ticket, "id" | "folio">) => Promise<Ticket | null>
  actualizarTicket: (id: string, data: Partial<Ticket>) => Promise<void>
  eliminarTicket: (id: string) => Promise<boolean>
  convertirTicketEnOrden: (ticket: Ticket) => Promise<OrdenServicio | null>

  crearCotizacion: (
    data: Omit<Cotizacion, "id" | "folio" | "createdAt">,
  ) => Promise<Cotizacion | null>
  actualizarCotizacion: (id: string, data: Partial<Cotizacion>) => Promise<boolean>
  eliminarCotizacion: (id: string) => Promise<boolean>
  convertirCotizacionEnOrden: (cotizacion: Cotizacion) => Promise<OrdenServicio | null>

  crearFactura: (
    data: Omit<Factura, "id" | "folio" | "montoPagado" | "saldo" | "createdAt">,
  ) => Promise<Factura | null>
  actualizarFactura: (id: string, data: Partial<Factura>) => Promise<void>
  eliminarFactura: (id: string) => Promise<boolean>
  facturarOrden: (orden: OrdenServicio) => Promise<Factura | null>

  registrarPago: (
    data: Omit<Pago, "id" | "folio" | "createdAt">,
  ) => Promise<Pago | null>
  eliminarPago: (id: string) => Promise<boolean>

  crearTecnico: (data: Omit<Tecnico, "id">) => Promise<Tecnico | null>
  actualizarTecnico: (id: string, data: Partial<Tecnico>) => Promise<void>
  eliminarTecnico: (id: string) => Promise<boolean>

  crearCampana: (
    data: Omit<MarketingCampana, "id" | "createdAt">,
  ) => Promise<MarketingCampana | null>
  actualizarCampana: (id: string, data: Partial<MarketingCampana>) => Promise<void>
  eliminarCampana: (id: string) => Promise<boolean>

  crearLead: (data: Omit<Lead, "id" | "createdAt">) => Promise<Lead | null>
  actualizarLead: (id: string, data: Partial<Lead>) => Promise<void>
  eliminarLead: (id: string) => Promise<boolean>
  registrarActividadLead: (
    leadId: string,
    tipo: LeadActividad["tipo"],
    descripcion: string,
  ) => Promise<void>
  convertirLeadEnCliente: (lead: Lead) => Promise<Cliente | null>

  enviarMensajeWhatsApp: (
    telefono: string,
    mensaje: string,
    contexto?: { leadId?: string | null; clienteId?: string | null },
  ) => Promise<MensajeWhatsApp | null>
  agregarNotaWhatsApp: (
    telefono: string,
    nota: string,
    contexto?: { leadId?: string | null; clienteId?: string | null },
  ) => Promise<MensajeWhatsApp | null>
  marcarConversacionLeida: (telefono: string) => Promise<void>
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => createClient(), [])

  const [clientes, setClientes] = React.useState<Cliente[]>([])
  const [equipos, setEquipos] = React.useState<Equipo[]>([])
  const [ordenes, setOrdenes] = React.useState<OrdenServicio[]>([])
  const [tickets, setTickets] = React.useState<Ticket[]>([])
  const [cotizaciones, setCotizaciones] = React.useState<Cotizacion[]>([])
  const [facturas, setFacturas] = React.useState<Factura[]>([])
  const [pagos, setPagos] = React.useState<Pago[]>([])
  const [tecnicos, setTecnicos] = React.useState<Tecnico[]>([])
  const [campanas, setCampanas] = React.useState<MarketingCampana[]>([])
  const [leads, setLeads] = React.useState<Lead[]>([])
  const [leadActividades, setLeadActividades] = React.useState<LeadActividad[]>([])
  const [mensajesWhatsApp, setMensajesWhatsApp] = React.useState<MensajeWhatsApp[]>([])
  const [usuarios, setUsuarios] = React.useState<Usuario[]>([])
  const [usuarioActual, setUsuarioActual] = React.useState<Usuario>(USUARIO_PLACEHOLDER)
  const [cargando, setCargando] = React.useState(true)

  const cargar = React.useCallback(async () => {
      const [
        clientesRes,
        equiposRes,
        ordenesRes,
        ticketsRes,
        cotizacionesRes,
        facturasRes,
        pagosRes,
        tecnicosRes,
        campanasRes,
        leadsRes,
        leadActividadesRes,
        mensajesWhatsAppRes,
        perfilesRes,
        userRes,
      ] = await Promise.all([
        supabase.from("clientes").select("*").order("nombre"),
        supabase.from("equipos").select("*").order("created_at", { ascending: false }),
        supabase.from("ordenes_servicio").select("*").order("folio", { ascending: false }),
        supabase.from("tickets").select("*").order("folio", { ascending: false }),
        supabase.from("cotizaciones").select("*").order("folio", { ascending: false }),
        supabase.from("facturas").select("*").order("folio", { ascending: false }),
        supabase.from("pagos").select("*").order("folio", { ascending: false }),
        supabase.from("tecnicos").select("*").order("nombre"),
        supabase.from("marketing_campanas").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("lead_actividades").select("*").order("created_at", { ascending: false }),
        supabase.from("whatsapp_mensajes").select("*").order("created_at", { ascending: true }),
        supabase.from("profiles").select("*").order("nombre_completo"),
        supabase.auth.getUser(),
      ])

      if (clientesRes.data) setClientes(clientesRes.data.map(mapCliente))
      if (equiposRes.data) setEquipos(equiposRes.data.map(mapEquipo))
      if (ordenesRes.data) setOrdenes(ordenesRes.data.map(mapOrden))
      if (ticketsRes.data) setTickets(ticketsRes.data.map(mapTicket))
      if (cotizacionesRes.data) setCotizaciones(cotizacionesRes.data.map(mapCotizacion))
      if (facturasRes.data) setFacturas(facturasRes.data.map(mapFactura))
      if (pagosRes.data) setPagos(pagosRes.data.map(mapPago))
      if (tecnicosRes.data) setTecnicos(tecnicosRes.data.map(mapTecnico))
      if (campanasRes.data) setCampanas(campanasRes.data.map(mapCampana))
      if (leadsRes.data) setLeads(leadsRes.data.map(mapLead))
      if (leadActividadesRes.data)
        setLeadActividades(leadActividadesRes.data.map(mapLeadActividad))
      if (mensajesWhatsAppRes.data)
        setMensajesWhatsApp(mensajesWhatsAppRes.data.map(mapMensajeWhatsApp))
      if (perfilesRes.data) {
        const lista = perfilesRes.data.map(mapUsuario)
        setUsuarios(lista)
        const uid = userRes.data.user?.id
        const actual = lista.find((u) => u.id === uid)
        if (actual) setUsuarioActual(actual)
        else if (userRes.data.user) {
          setUsuarioActual({
            id: userRes.data.user.id,
            nombre: userRes.data.user.email ?? "Usuario",
            email: userRes.data.user.email ?? "",
            rol: "Coordinador",
            activo: true,
            clienteId: null,
          })
        }
      }

      const err =
        clientesRes.error ||
        equiposRes.error ||
        ordenesRes.error ||
        ticketsRes.error ||
        cotizacionesRes.error ||
        facturasRes.error ||
        pagosRes.error ||
        tecnicosRes.error ||
        perfilesRes.error
      if (err) {
        console.log("[v0] Error al cargar datos:", err.message)
        toast.error("No se pudieron cargar todos los datos.")
      }

      setCargando(false)
  }, [supabase])

  React.useEffect(() => {
    cargar()
  }, [cargar])

  const value = React.useMemo<StoreContextValue>(() => {
    return {
      clientes,
      equipos,
      ordenes,
      tickets,
      cotizaciones,
      facturas,
      pagos,
      tecnicos,
      campanas,
      leads,
      leadActividades,
      mensajesWhatsApp,
      usuarios,
      usuarioActual,
      cargando,
      recargar: cargar,

      crearCliente: async (data) => {
        const { data: row, error } = await supabase
          .from("clientes")
          .insert(clienteToDb(data))
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear el cliente.")
          return null
        }
        const nuevo = mapCliente(row)
        setClientes((prev) => [nuevo, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        toast.success("Cliente creado.")
        return nuevo
      },
      actualizarCliente: async (clienteId, data) => {
        const { data: row, error } = await supabase
          .from("clientes")
          .update(clienteToDb(data))
          .eq("id", clienteId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar el cliente.")
          return
        }
        const actualizado = mapCliente(row)
        setClientes((prev) => prev.map((c) => (c.id === clienteId ? actualizado : c)))
        toast.success("Cliente actualizado.")
      },
      eliminarCliente: async (clienteId) => {
        const { error } = await supabase.from("clientes").delete().eq("id", clienteId)
        if (error) {
          const asociadas = ordenes.some((o) => o.clienteId === clienteId)
          toast.error(
            asociadas
              ? "No se puede eliminar: el cliente tiene órdenes asociadas."
              : "No se pudo eliminar el cliente.",
          )
          return false
        }
        setClientes((prev) => prev.filter((c) => c.id !== clienteId))
        // Los equipos del cliente se eliminan en cascada en la base de datos.
        setEquipos((prev) => prev.filter((e) => e.clienteId !== clienteId))
        toast.success("Cliente eliminado.")
        return true
      },

      crearEquipo: async (data) => {
        const { data: row, error } = await supabase
          .from("equipos")
          .insert(equipoToDb(data))
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo registrar el equipo.")
          return null
        }
        const nuevo = mapEquipo(row)
        setEquipos((prev) => [nuevo, ...prev])
        toast.success("Equipo registrado.")
        return nuevo
      },
      actualizarEquipo: async (equipoId, data) => {
        const { data: row, error } = await supabase
          .from("equipos")
          .update(equipoToDb(data))
          .eq("id", equipoId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar el equipo.")
          return
        }
        const actualizado = mapEquipo(row)
        setEquipos((prev) => prev.map((e) => (e.id === equipoId ? actualizado : e)))
        toast.success("Equipo actualizado.")
      },
      eliminarEquipo: async (equipoId) => {
        const { error } = await supabase.from("equipos").delete().eq("id", equipoId)
        if (error) {
          toast.error("No se pudo eliminar el equipo.")
          return false
        }
        setEquipos((prev) => prev.filter((e) => e.id !== equipoId))
        // Las órdenes que referencian el equipo quedan con equipo_id nulo (set null).
        setOrdenes((prev) =>
          prev.map((o) => (o.equipoId === equipoId ? { ...o, equipoId: "" } : o)),
        )
        toast.success("Equipo eliminado.")
        return true
      },

      crearOrden: async (data) => {
        // creado_por es una columna uuid (FK a auth.users); siempre debe ser el
        // id del usuario en sesión, nunca su nombre.
        const payload = ordenToDb({ ...data, creadoPor: usuarioActual.id })
        const { data: row, error } = await supabase
          .from("ordenes_servicio")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear la orden.")
          return null
        }
        const nueva = mapOrden(row)
        setOrdenes((prev) => [nueva, ...prev])
        toast.success(`Orden ${nueva.folio} creada.`)
        return nueva
      },
      actualizarOrden: async (ordenId, data) => {
        const { data: row, error } = await supabase
          .from("ordenes_servicio")
          .update(ordenToDb(data))
          .eq("id", ordenId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar la orden.")
          return
        }
        const actualizada = mapOrden(row)
        setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? actualizada : o)))
        toast.success("Orden actualizada.")
      },
      asignarOrdenConGarantia: async (ordenId, tecnicoId, historial, garantia) => {
        // La base de datos expone esta operación como una RPC atómica.
        // La función realiza la asignación y guarda la garantía en una sola transacción.
        const { data: row, error } = await supabase
          .rpc("asignar_orden_con_garantia_v2", {
            p_orden_id: ordenId,
            p_tecnico_id: tecnicoId,
            p_historial: historial,
            p_orden_origen_id: garantia.ordenOrigenId,
            p_tiene_garantia: garantia.tieneGarantia,
            p_duracion_valor: garantia.tieneGarantia ? garantia.duracionValor : null,
            p_duracion_unidad: garantia.tieneGarantia ? garantia.duracionUnidad : null,
            p_cobertura: garantia.tieneGarantia ? garantia.cobertura : null,
            p_condiciones: garantia.tieneGarantia ? garantia.condiciones : null,
            p_resultado: garantia.resultado,
          })
          .single()

        if (error || !row) {
          toast.error(error?.message ?? "No se pudo asignar el técnico.")
          return null
        }

        const actualizada = mapOrden(row)
        setOrdenes((prev) => prev.map((o) => (o.id === ordenId ? actualizada : o)))
        return actualizada
      },
      eliminarOrden: async (ordenId) => {
        const { error } = await supabase.from("ordenes_servicio").delete().eq("id", ordenId)
        if (error) {
          toast.error("No se pudo eliminar la orden.")
          return false
        }
        setOrdenes((prev) => prev.filter((o) => o.id !== ordenId))
        // El ticket asociado (si lo hay) queda con orden_id nulo (set null).
        setTickets((prev) =>
          prev.map((t) => (t.ordenId === ordenId ? { ...t, ordenId: null } : t)),
        )
        toast.success("Orden eliminada.")
        return true
      },

      crearTicket: async (data) => {
        const payload = ticketToDb({ ...data, creadoPor: usuarioActual.id })
        const { data: row, error } = await supabase
          .from("tickets")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear el ticket.")
          return null
        }
        const nuevo = mapTicket(row)
        setTickets((prev) => [nuevo, ...prev])
        toast.success(`Ticket ${nuevo.folio} creado.`)
        return nuevo
      },
      actualizarTicket: async (ticketId, data) => {
        const { data: row, error } = await supabase
          .from("tickets")
          .update(ticketToDb(data))
          .eq("id", ticketId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar el ticket.")
          return
        }
        const actualizado = mapTicket(row)
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? actualizado : t)))
        toast.success("Ticket actualizado.")
      },
      eliminarTicket: async (ticketId) => {
        const { error } = await supabase.from("tickets").delete().eq("id", ticketId)
        if (error) {
          toast.error("No se pudo eliminar el ticket.")
          return false
        }
        setTickets((prev) => prev.filter((t) => t.id !== ticketId))
        toast.success("Ticket eliminado.")
        return true
      },
      convertirTicketEnOrden: async (ticket) => {
        if (ticket.ordenId) {
          toast.error("Este ticket ya tiene una orden asociada.")
          return null
        }
        // La orden solo admite Normal/Alta/Urgente; "Baja" se mapea a "Normal".
        const prioridadOrden =
          ticket.prioridad === "Baja" ? "Normal" : ticket.prioridad
        const observaciones = ticket.ubicacion
          ? `Generada desde ${ticket.folio}. Ubicación: ${ticket.ubicacion}`
          : `Generada desde ${ticket.folio}.`
        const payload = ordenToDb({
          clienteId: ticket.clienteId,
          equipoId: ticket.equipoId ?? "",
          tecnicoId: null,
          fechaSolicitud: ticket.fechaSolicitud,
          fechaProgramada: null,
          fechaInicio: null,
          fechaCierre: null,
          tipoServicio: ticket.tipoServicio,
          prioridad: prioridadOrden,
          estado: "Pendiente",
          descripcionFalla: ticket.descripcionFalla,
          diagnostico: "",
          trabajoRealizado: "",
          materiales: "",
          horasTrabajo: null,
          observaciones,
          creadoPor: usuarioActual.id,
          ticketId: ticket.id,
        })
        const { data: row, error } = await supabase
          .from("ordenes_servicio")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo generar la orden desde el ticket.")
          return null
        }
        const nueva = mapOrden(row)
        setOrdenes((prev) => [nueva, ...prev])

        const { data: trow } = await supabase
          .from("tickets")
          .update({ orden_id: nueva.id, estado: "Asignado" })
          .eq("id", ticket.id)
          .select("*")
          .single()
        if (trow) {
          const actualizado = mapTicket(trow)
          setTickets((prev) => prev.map((t) => (t.id === ticket.id ? actualizado : t)))
        }
        toast.success(`Orden ${nueva.folio} generada desde ${ticket.folio}.`)
        return nueva
      },

      crearCotizacion: async (data) => {
        const payload = cotizacionToDb({ ...data, creadoPor: usuarioActual.id })
        const { data: row, error } = await supabase
          .from("cotizaciones")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          console.error("[Cotizaciones] Error al crear cotización:", error)
          toast.error(
            error
              ? `Error al crear cotización: ${error.message}`
              : "No se recibió la cotización creada desde Supabase.",
          )
          return null
        }
        const nueva = mapCotizacion(row)
        setCotizaciones((prev) => [nueva, ...prev])
        toast.success(`Cotización ${nueva.folio} creada.`)
        return nueva
      },
      actualizarCotizacion: async (cotizacionId, data) => {
        const { data: row, error } = await supabase
          .from("cotizaciones")
          .update(cotizacionToDb(data))
          .eq("id", cotizacionId)
          .select("*")
          .single()

        if (error || !row) {
          console.error("[Cotizaciones] Error al actualizar cotización:", error)
          toast.error(
            error
              ? `Error al actualizar cotización: ${error.message}`
              : "No se recibió la cotización actualizada desde Supabase.",
          )
          return false
        }

        const actualizada = mapCotizacion(row)
        setCotizaciones((prev) =>
          prev.map((c) => (c.id === cotizacionId ? actualizada : c)),
        )
        toast.success("Cotización actualizada.")
        return true
      },
      eliminarCotizacion: async (cotizacionId) => {
        const { error } = await supabase
          .from("cotizaciones")
          .delete()
          .eq("id", cotizacionId)
        if (error) {
          toast.error("No se pudo eliminar la cotización.")
          return false
        }
        setCotizaciones((prev) => prev.filter((c) => c.id !== cotizacionId))
        toast.success("Cotización eliminada.")
        return true
      },
      convertirCotizacionEnOrden: async (cotizacion) => {
        if (cotizacion.ordenId) {
          toast.error("Esta cotización ya tiene una orden asociada.")
          return null
        }
        // Resumen de conceptos como texto para el campo materiales de la orden.
        const materiales = cotizacion.conceptos
          .map(
            (c) =>
              `${c.cantidad} x ${c.descripcion} (${c.tipo})`,
          )
          .join("\n")
        const payload = ordenToDb({
          clienteId: cotizacion.clienteId,
          equipoId: cotizacion.equipoId ?? "",
          tecnicoId: null,
          fechaSolicitud: new Date().toISOString().slice(0, 10),
          fechaProgramada: null,
          fechaInicio: null,
          fechaCierre: null,
          tipoServicio: "Correctivo",
          prioridad: "Normal",
          estado: "Pendiente",
          descripcionFalla: `Generada desde cotización ${cotizacion.folio}.`,
          diagnostico: "",
          trabajoRealizado: "",
          materiales,
          horasTrabajadas: null,
          observaciones: cotizacion.observaciones,
          creadoPor: usuarioActual.id,
        })
        const { data: row, error } = await supabase
          .from("ordenes_servicio")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo generar la orden desde la cotización.")
          return null
        }
        const nueva = mapOrden(row)
        setOrdenes((prev) => [nueva, ...prev])

        const { data: crow } = await supabase
          .from("cotizaciones")
          .update({ orden_id: nueva.id, estado: "Aceptada" })
          .eq("id", cotizacion.id)
          .select("*")
          .single()
        if (crow) {
          const actualizada = mapCotizacion(crow)
          setCotizaciones((prev) =>
            prev.map((c) => (c.id === cotizacion.id ? actualizada : c)),
          )
        }
        toast.success(`Orden ${nueva.folio} generada desde ${cotizacion.folio}.`)
        return nueva
      },

      crearFactura: async (data) => {
        const payload = facturaToDb({ ...data, creadoPor: usuarioActual.id })
        const { data: row, error } = await supabase
          .from("facturas")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear la factura.")
          return null
        }
        const nueva = mapFactura(row)
        setFacturas((prev) => [nueva, ...prev])
        toast.success(`Factura ${nueva.folio} creada.`)
        return nueva
      },
      actualizarFactura: async (facturaId, data) => {
        const { data: row, error } = await supabase
          .from("facturas")
          .update(facturaToDb(data))
          .eq("id", facturaId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar la factura.")
          return
        }
        const actualizada = mapFactura(row)
        setFacturas((prev) =>
          prev.map((f) => (f.id === facturaId ? actualizada : f)),
        )
        toast.success("Factura actualizada.")
      },
      eliminarFactura: async (facturaId) => {
        const { error } = await supabase
          .from("facturas")
          .delete()
          .eq("id", facturaId)
        if (error) {
          toast.error("No se pudo eliminar la factura.")
          return false
        }
        setFacturas((prev) => prev.filter((f) => f.id !== facturaId))
        setPagos((prev) => prev.filter((p) => p.facturaId !== facturaId))
        toast.success("Factura eliminada.")
        return true
      },
      facturarOrden: async (orden) => {
        const existente = facturas.find((f) => f.ordenId === orden.id)
        if (existente) {
          toast.error(`La orden ${orden.folio} ya tiene la factura ${existente.folio}.`)
          return null
        }
        const conceptos = [
          {
            descripcion: `Servicio de la orden ${orden.folio}`,
            tipo: "Mano de obra" as const,
            cantidad: 1,
            precioUnitario: 0,
            descuento: 0,
          },
        ]
        const payload = facturaToDb({
          clienteId: orden.clienteId,
          ordenId: orden.id,
          cotizacionId: null,
          conceptos,
          subtotal: 0,
          descuento: 0,
          iva: 0,
          total: 0,
          fechaEmision: new Date().toISOString().slice(0, 10),
          fechaVencimiento: null,
          condiciones: "",
          observaciones: `Factura generada desde la orden ${orden.folio}. Ajuste los importes antes de emitir.`,
          estado: "Pendiente",
          creadoPor: usuarioActual.id,
        })
        const { data: row, error } = await supabase
          .from("facturas")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo generar la factura desde la orden.")
          return null
        }
        const nueva = mapFactura(row)
        setFacturas((prev) => [nueva, ...prev])
        toast.success(`Factura ${nueva.folio} generada desde ${orden.folio}.`)
        return nueva
      },

      registrarPago: async (data) => {
        const payload = pagoToDb({ ...data, creadoPor: usuarioActual.id })
        const { data: row, error } = await supabase
          .from("pagos")
          .insert(payload)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo registrar el pago.")
          return null
        }
        const nuevo = mapPago(row)
        setPagos((prev) => [nuevo, ...prev])
        // La factura recalcula monto_pagado/saldo/estado vía trigger; recargamos.
        const { data: frow } = await supabase
          .from("facturas")
          .select("*")
          .eq("id", data.facturaId)
          .single()
        if (frow) {
          const actualizada = mapFactura(frow)
          setFacturas((prev) =>
            prev.map((f) => (f.id === actualizada.id ? actualizada : f)),
          )
        }
        toast.success(`Pago ${nuevo.folio} registrado.`)
        return nuevo
      },
      eliminarPago: async (pagoId) => {
        const pago = pagos.find((p) => p.id === pagoId)
        const { error } = await supabase
          .from("pagos")
          .delete()
          .eq("id", pagoId)
        if (error) {
          toast.error("No se pudo eliminar el pago.")
          return false
        }
        setPagos((prev) => prev.filter((p) => p.id !== pagoId))
        if (pago) {
          const { data: frow } = await supabase
            .from("facturas")
            .select("*")
            .eq("id", pago.facturaId)
            .single()
          if (frow) {
            const actualizada = mapFactura(frow)
            setFacturas((prev) =>
              prev.map((f) => (f.id === actualizada.id ? actualizada : f)),
            )
          }
        }
        toast.success("Pago eliminado.")
        return true
      },

      crearTecnico: async (data) => {
        const { data: row, error } = await supabase
          .from("tecnicos")
          .insert(tecnicoToDb(data))
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear el técnico.")
          return null
        }
        const nuevo = mapTecnico(row)
        setTecnicos((prev) => [nuevo, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)))
        toast.success("Técnico creado.")
        return nuevo
      },
      actualizarTecnico: async (tecnicoId, data) => {
        const { data: row, error } = await supabase
          .from("tecnicos")
          .update(tecnicoToDb(data))
          .eq("id", tecnicoId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar el técnico.")
          return
        }
        const actualizado = mapTecnico(row)
        setTecnicos((prev) => prev.map((t) => (t.id === tecnicoId ? actualizado : t)))
        toast.success("Técnico actualizado.")
      },
      eliminarTecnico: async (tecnicoId) => {
        const { error } = await supabase.from("tecnicos").delete().eq("id", tecnicoId)
        if (error) {
          toast.error("No se pudo eliminar el técnico.")
          return false
        }
        setTecnicos((prev) => prev.filter((t) => t.id !== tecnicoId))
        // Las órdenes que referencian al técnico quedan sin asignar (set null).
        setOrdenes((prev) =>
          prev.map((o) => (o.tecnicoId === tecnicoId ? { ...o, tecnicoId: null } : o)),
        )
        toast.success("Técnico eliminado.")
        return true
      },

      crearCampana: async (data) => {
        const { data: row, error } = await supabase
          .from("marketing_campanas")
          .insert(campanaToDb(data))
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear la campaña.")
          return null
        }
        const nueva = mapCampana(row)
        setCampanas((prev) => [nueva, ...prev])
        toast.success("Campaña creada.")
        return nueva
      },
      actualizarCampana: async (campanaId, data) => {
        const { data: row, error } = await supabase
          .from("marketing_campanas")
          .update(campanaToDb(data))
          .eq("id", campanaId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar la campaña.")
          return
        }
        const actualizada = mapCampana(row)
        setCampanas((prev) => prev.map((c) => (c.id === campanaId ? actualizada : c)))
        toast.success("Campaña actualizada.")
      },
      eliminarCampana: async (campanaId) => {
        const { error } = await supabase
          .from("marketing_campanas")
          .delete()
          .eq("id", campanaId)
        if (error) {
          toast.error("No se pudo eliminar la campaña.")
          return false
        }
        setCampanas((prev) => prev.filter((c) => c.id !== campanaId))
        // Los leads asociados quedan sin campaña (set null en la BD).
        setLeads((prev) =>
          prev.map((l) => (l.campanaId === campanaId ? { ...l, campanaId: null } : l)),
        )
        toast.success("Campaña eliminada.")
        return true
      },

      crearLead: async (data) => {
        const { data: row, error } = await supabase
          .from("leads")
          .insert(leadToDb({ ...data, creadoPor: usuarioActual.id }))
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo crear el lead.")
          return null
        }
        const nuevo = mapLead(row)
        setLeads((prev) => [nuevo, ...prev])
        // Registra el alta como primera actividad de la bitácora.
        const { data: actRow } = await supabase
          .from("lead_actividades")
          .insert(
            leadActividadToDb({
              leadId: nuevo.id,
              tipo: "Nota",
              descripcion: `Lead registrado desde ${nuevo.origen || "origen sin especificar"}.`,
              usuarioId: usuarioActual.id,
            }),
          )
          .select("*")
          .single()
        if (actRow) setLeadActividades((prev) => [mapLeadActividad(actRow), ...prev])
        toast.success("Lead registrado.")
        return nuevo
      },
      actualizarLead: async (leadId, data) => {
        const anterior = leads.find((l) => l.id === leadId)
        const { data: row, error } = await supabase
          .from("leads")
          .update(leadToDb(data))
          .eq("id", leadId)
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo actualizar el lead.")
          return
        }
        const actualizado = mapLead(row)
        setLeads((prev) => prev.map((l) => (l.id === leadId ? actualizado : l)))
        // Si cambió la etapa del pipeline, lo dejamos asentado en la bitácora.
        if (data.estado && anterior && anterior.estado !== data.estado) {
          const { data: actRow } = await supabase
            .from("lead_actividades")
            .insert(
              leadActividadToDb({
                leadId,
                tipo: "Cambio de estado",
                descripcion: `Etapa: ${anterior.estado} → ${data.estado}.`,
                usuarioId: usuarioActual.id,
              }),
            )
            .select("*")
            .single()
          if (actRow) setLeadActividades((prev) => [mapLeadActividad(actRow), ...prev])
        }
        toast.success("Lead actualizado.")
      },
      eliminarLead: async (leadId) => {
        const { error } = await supabase.from("leads").delete().eq("id", leadId)
        if (error) {
          toast.error("No se pudo eliminar el lead.")
          return false
        }
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
        setLeadActividades((prev) => prev.filter((a) => a.leadId !== leadId))
        toast.success("Lead eliminado.")
        return true
      },
      registrarActividadLead: async (leadId, tipo, descripcion) => {
        const { data: row, error } = await supabase
          .from("lead_actividades")
          .insert(
            leadActividadToDb({ leadId, tipo, descripcion, usuarioId: usuarioActual.id }),
          )
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo registrar la actividad.")
          return
        }
        setLeadActividades((prev) => [mapLeadActividad(row), ...prev])
        // Actualiza la marca de último contacto del lead.
        const ahora = new Date().toISOString()
        const { data: lrow } = await supabase
          .from("leads")
          .update({ ultimo_contacto: ahora })
          .eq("id", leadId)
          .select("*")
          .single()
        if (lrow) {
          const actualizado = mapLead(lrow)
          setLeads((prev) => prev.map((l) => (l.id === leadId ? actualizado : l)))
        }
        toast.success("Actividad registrada.")
      },
      convertirLeadEnCliente: async (lead) => {
        if (lead.clienteId) {
          toast.error("Este lead ya está vinculado a un cliente.")
          return null
        }
        // Detección de duplicados: si ya existe un cliente con el mismo correo
        // o teléfono, se vincula el lead a ese cliente en lugar de crear uno nuevo.
        const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase()
        const correoLead = norm(lead.correo)
        const telLead = norm(lead.telefono).replace(/\D/g, "")
        const existente = clientes.find((c) => {
          const correoOk = correoLead && norm(c.email) === correoLead
          const telOk =
            telLead.length >= 7 && norm(c.telefono).replace(/\D/g, "") === telLead
          return correoOk || telOk
        })
        if (existente) {
          const { data: lrow } = await supabase
            .from("leads")
            .update({ cliente_id: existente.id, estado: "Ganado" })
            .eq("id", lead.id)
            .select("*")
            .single()
          if (lrow) {
            const actualizado = mapLead(lrow)
            setLeads((prev) => prev.map((l) => (l.id === lead.id ? actualizado : l)))
          }
          const { data: actRow } = await supabase
            .from("lead_actividades")
            .insert(
              leadActividadToDb({
                leadId: lead.id,
                tipo: "Cambio de estado",
                descripcion: `Lead vinculado a cliente existente: ${existente.nombre}.`,
                usuarioId: usuarioActual.id,
              }),
            )
            .select("*")
            .single()
          if (actRow) setLeadActividades((prev) => [mapLeadActividad(actRow), ...prev])
          toast.success(`Lead vinculado a cliente existente: ${existente.nombre}.`)
          return existente
        }
        const { data: crow, error: cerror } = await supabase
          .from("clientes")
          .insert(
            clienteToDb({
              nombre: lead.empresa || lead.nombre || "Cliente sin nombre",
              rfc: "",
              contacto: lead.empresa ? lead.nombre : "",
              telefono: lead.telefono,
              email: lead.correo,
              direccion: "",
              ciudad: lead.ciudad,
              notas: lead.descripcionNecesidad
                ? `Convertido desde lead. Necesidad: ${lead.descripcionNecesidad}`
                : "Convertido desde lead.",
            }),
          )
          .select("*")
          .single()
        if (cerror || !crow) {
          toast.error("No se pudo crear el cliente desde el lead.")
          return null
        }
        const nuevoCliente = mapCliente(crow)
        setClientes((prev) =>
          [nuevoCliente, ...prev].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        )
        // Vincula el lead al cliente y lo marca como ganado.
        const { data: lrow } = await supabase
          .from("leads")
          .update({ cliente_id: nuevoCliente.id, estado: "Ganado" })
          .eq("id", lead.id)
          .select("*")
          .single()
        if (lrow) {
          const actualizado = mapLead(lrow)
          setLeads((prev) => prev.map((l) => (l.id === lead.id ? actualizado : l)))
        }
        const { data: actRow } = await supabase
          .from("lead_actividades")
          .insert(
            leadActividadToDb({
              leadId: lead.id,
              tipo: "Cambio de estado",
              descripcion: `Lead convertido en cliente: ${nuevoCliente.nombre}.`,
              usuarioId: usuarioActual.id,
            }),
          )
          .select("*")
          .single()
        if (actRow) setLeadActividades((prev) => [mapLeadActividad(actRow), ...prev])
        toast.success(`Cliente creado desde el lead: ${nuevoCliente.nombre}.`)
        return nuevoCliente
      },

      enviarMensajeWhatsApp: async (telefono, mensaje, contexto) => {
        const texto = mensaje.trim()
        if (!texto) return null
        // El envío real a la API de WhatsApp Business ocurre en el endpoint
        // server-side, que también persiste el mensaje. Aquí solo llamamos.
        const res = await fetch("/api/whatsapp/enviar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telefono,
            mensaje: texto,
            leadId: contexto?.leadId ?? null,
            clienteId: contexto?.clienteId ?? null,
          }),
        })
        const payload = await res.json().catch(() => null)
        if (!res.ok || !payload?.mensaje) {
          toast.error(payload?.error ?? "No se pudo enviar el mensaje de WhatsApp.")
          return null
        }
        const nuevo = mapMensajeWhatsApp(payload.mensaje)
        setMensajesWhatsApp((prev) => [...prev, nuevo])
        return nuevo
      },

      agregarNotaWhatsApp: async (telefono, nota, contexto) => {
        const texto = nota.trim()
        if (!texto) return null
        // Nota interna: no se envía a WhatsApp, solo queda en la conversación.
        const { data: row, error } = await supabase
          .from("whatsapp_mensajes")
          .insert(
            mensajeWhatsAppToDb({
              telefono,
              direccion: "Saliente",
              tipo: "Nota",
              mensaje: texto,
              estado: "Enviado",
              notaInterna: true,
              leido: true,
              leadId: contexto?.leadId ?? null,
              clienteId: contexto?.clienteId ?? null,
              enviadoPor: usuarioActual.id || null,
            }),
          )
          .select("*")
          .single()
        if (error || !row) {
          toast.error("No se pudo guardar la nota.")
          return null
        }
        const nuevo = mapMensajeWhatsApp(row)
        setMensajesWhatsApp((prev) => [...prev, nuevo])
        return nuevo
      },

      marcarConversacionLeida: async (telefono) => {
        // Optimista: marca en memoria y persiste los entrantes no leídos.
        setMensajesWhatsApp((prev) =>
          prev.map((m) =>
            m.telefono === telefono && m.direccion === "Entrante" && !m.leido
              ? { ...m, leido: true }
              : m,
          ),
        )
        await supabase
          .from("whatsapp_mensajes")
          .update({ leido: true })
          .eq("telefono", telefono)
          .eq("direccion", "entrante")
          .eq("leido", false)
      },
    }
  }, [clientes, equipos, ordenes, tickets, cotizaciones, facturas, pagos, tecnicos, campanas, leads, leadActividades, mensajesWhatsApp, usuarios, usuarioActual, cargando, supabase])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const ctx = React.useContext(StoreContext)
  if (!ctx) {
    throw new Error("useStore debe usarse dentro de <StoreProvider>")
  }
  return ctx
}

// Selectores auxiliares --------------------------------------------------

export function useCliente(clienteId: string | null | undefined) {
  const { clientes } = useStore()
  return clientes.find((c) => c.id === clienteId) ?? null
}

export function useEquipo(equipoId: string | null | undefined) {
  const { equipos } = useStore()
  return equipos.find((e) => e.id === equipoId) ?? null
}

export function useTecnico(tecnicoId: string | null | undefined) {
  const { tecnicos } = useStore()
  return tecnicos.find((t) => t.id === tecnicoId) ?? null
}

export function useTicket(ticketId: string | null | undefined) {
  const { tickets } = useStore()
  return tickets.find((t) => t.id === ticketId) ?? null
}

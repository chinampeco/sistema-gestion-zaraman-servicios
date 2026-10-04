// Conversión entre las filas de Supabase (snake_case) y los tipos de dominio
// de la aplicación (camelCase). Centralizar el mapeo aquí mantiene las
// pantallas y el store sin detalles del esquema de la base de datos.

import type {
  Cliente,
  ConceptoCotizacion,
  Cotizacion,
  Equipo,
  EstadoCotizacion,
  EstadoEquipo,
  EstadoFactura,
  EstadoOrden,
  EstadoTicket,
  EvidenciaOrden,
  EstadoLead,
  Factura,
  FaseEvidencia,
  Lead,
  LeadActividad,
  MarketingCampana,
  MaterialOrden,
  MensajeWhatsApp,
  DireccionMensaje,
  TipoMensajeWhatsApp,
  EstadoMensajeWhatsApp,
  MetodoPago,
  OrdenServicio,
  Pago,
  Prioridad,
  PrioridadLead,
  PrioridadTicket,
  RolUsuario,
  Tecnico,
  Ticket,
  TipoActividadLead,
  TipoConcepto,
  TipoServicio,
  Usuario,
} from "@/lib/types"

// Helpers -----------------------------------------------------------------

/** Texto no nulo: convierte null/undefined en cadena vacía. */
function txt(value: unknown): string {
  return value == null ? "" : String(value)
}

/** Fecha o null: normaliza cadenas vacías a null. */
function fecha(value: unknown): string | null {
  if (value == null || value === "") return null
  return String(value).slice(0, 10)
}

// DB -> App ---------------------------------------------------------------

export function mapCliente(row: Record<string, any>): Cliente {
  return {
    id: row.id,
    nombre: txt(row.nombre_empresa),
    rfc: txt(row.rfc),
    contacto: txt(row.contacto),
    email: txt(row.correo),
    telefono: txt(row.telefono),
    direccion: txt(row.direccion),
    ciudad: txt(row.ciudad),
    notas: txt(row.notas),
    createdAt: fecha(row.created_at) ?? "",
  }
}

export function mapEquipo(row: Record<string, any>): Equipo {
  return {
    id: row.id,
    clienteId: txt(row.cliente_id),
    tipo: txt(row.tipo_equipo),
    marca: txt(row.marca),
    modelo: txt(row.modelo),
    numeroSerie: txt(row.numero_serie),
    capacidad: txt(row.capacidad),
    ubicacion: txt(row.ubicacion),
    estado: (row.estado ?? "Operativo") as EstadoEquipo,
    fechaInstalacion: fecha(row.fecha_instalacion) ?? "",
    fechaUltimoServicio: fecha(row.fecha_ultimo_servicio),
    fechaProximoServicio: fecha(row.fecha_proximo_servicio),
    notas: txt(row.notas),
  }
}

export function mapOrden(row: Record<string, any>): OrdenServicio {
  return {
    id: row.id,
    folio: txt(row.folio),
    clienteId: txt(row.cliente_id),
    equipoId: txt(row.equipo_id),
    fechaSolicitud: fecha(row.fecha_solicitud) ?? "",
    fechaProgramada: fecha(row.fecha_programada),
    fechaInicio: fecha(row.fecha_inicio),
    fechaCierre: fecha(row.fecha_cierre),
    tipoServicio: (row.tipo_servicio ?? "Correctivo") as TipoServicio,
    prioridad: (row.prioridad ?? "Normal") as Prioridad,
    estado: (row.estado ?? "Pendiente") as EstadoOrden,
    descripcionFalla: txt(row.descripcion_falla),
    diagnostico: txt(row.diagnostico),
    trabajoRealizado: txt(row.trabajo_realizado),
    tecnicoId: row.tecnico_id ?? null,
    materiales: txt(row.materiales),
    materialesDetalle: mapMateriales(row.materiales_detalle),
    evidencias: mapEvidencias(row.evidencias),
    horasTrabajadas: row.horas_trabajadas == null ? null : Number(row.horas_trabajadas),
    observaciones: txt(row.observaciones),
    horaProgramada: row.hora_programada ?? null,
    firmaCliente: txt(row.firma_cliente),
    firmaFecha: row.firma_fecha ?? null,
    cerradaPor: row.cerrada_por ?? null,
    creadoPor: txt(row.creado_por),
    ticketId: row.ticket_id ?? null,
    historial: Array.isArray(row.historial) ? row.historial : [],
  }
}

function parseJsonArray(value: unknown): any[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed
    } catch {
      return []
    }
  }
  return []
}

export function mapMateriales(value: unknown): MaterialOrden[] {
  return parseJsonArray(value).map((m, i) => ({
    id: txt(m?.id) || `mat-${i}`,
    descripcion: txt(m?.descripcion),
    codigo: txt(m?.codigo),
    cantidad: m?.cantidad == null ? 0 : Number(m.cantidad),
    unidad: txt(m?.unidad) || "Pieza",
    precio: m?.precio == null ? 0 : Number(m.precio),
    observaciones: txt(m?.observaciones),
    tecnicoId: m?.tecnicoId ?? null,
    fecha: txt(m?.fecha),
  }))
}

export function mapEvidencias(value: unknown): EvidenciaOrden[] {
  return parseJsonArray(value).map((e, i) => ({
    id: txt(e?.id) || `ev-${i}`,
    url: txt(e?.url),
    path: txt(e?.path),
    fase: (e?.fase ?? "Durante") as FaseEvidencia,
    descripcion: txt(e?.descripcion),
    fecha: txt(e?.fecha),
  }))
}

export function mapTicket(row: Record<string, any>): Ticket {
  return {
    id: row.id,
    folio: txt(row.folio),
    clienteId: txt(row.cliente_id),
    equipoId: row.equipo_id ?? null,
    contacto: txt(row.contacto),
    ubicacion: txt(row.ubicacion),
    tipoServicio: (row.tipo_servicio ?? "Correctivo") as TipoServicio,
    prioridad: (row.prioridad ?? "Normal") as PrioridadTicket,
    estado: (row.estado ?? "Nuevo") as EstadoTicket,
    descripcionFalla: txt(row.descripcion_falla),
    fechaSolicitud: fecha(row.fecha_solicitud) ?? "",
    ordenId: row.orden_id ?? null,
    creadoPor: txt(row.creado_por),
  }
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapConceptos(value: unknown): ConceptoCotizacion[] {
  let arr: any[] = []
  if (Array.isArray(value)) arr = value
  else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) arr = parsed
    } catch {
      arr = []
    }
  }
  return arr.map((c) => ({
    descripcion: txt(c?.descripcion),
    tipo: (c?.tipo ?? "Material") as TipoConcepto,
    cantidad: num(c?.cantidad),
    precioUnitario: num(c?.precioUnitario ?? c?.precio_unitario),
    descuento: num(c?.descuento),
  }))
}

export function mapCotizacion(row: Record<string, any>): Cotizacion {
  return {
    id: row.id,
    folio: txt(row.folio),
    clienteId: txt(row.cliente_id),
    equipoId: row.equipo_id ?? null,
    contacto: txt(row.contacto),
    conceptos: mapConceptos(row.conceptos),
    subtotal: num(row.subtotal),
    descuento: num(row.descuento),
    iva: num(row.iva),
    total: num(row.total),
    vigencia: fecha(row.vigencia),
    condiciones: txt(row.condiciones),
    observaciones: txt(row.observaciones),
  estado: (row.estado ?? "Borrador") as EstadoCotizacion,
  ordenId: row.orden_id ?? null,
  leadId: row.lead_id ?? null,
  aceptadaEn: row.aceptada_en ?? null,
  aceptadaPor: row.aceptada_por ?? null,
  rechazadaEn: row.rechazada_en ?? null,
  rechazadaPor: row.rechazada_por ?? null,
  motivoRechazo: row.motivo_rechazo ?? null,
  historial: Array.isArray(row.historial) ? row.historial : [],
  creadoPor: txt(row.creado_por),
  createdAt: txt(row.created_at),
  }
  }

export function mapFactura(row: Record<string, any>): Factura {
  return {
    id: row.id,
    folio: txt(row.folio),
    clienteId: txt(row.cliente_id),
    ordenId: row.orden_id ?? null,
    cotizacionId: row.cotizacion_id ?? null,
    conceptos: mapConceptos(row.conceptos),
    subtotal: num(row.subtotal),
    descuento: num(row.descuento),
    iva: num(row.iva),
    total: num(row.total),
    montoPagado: num(row.monto_pagado),
    saldo: num(row.saldo),
  fechaEmision: fecha(row.fecha),
  fechaVencimiento: fecha(row.fecha_vencimiento),
    condiciones: txt(row.condiciones),
    observaciones: txt(row.observaciones),
    estado: (row.estado ?? "Pendiente") as EstadoFactura,
    creadoPor: txt(row.creado_por),
    createdAt: txt(row.created_at),
  }
}

export function mapPago(row: Record<string, any>): Pago {
  return {
    id: row.id,
    folio: txt(row.folio),
    facturaId: txt(row.factura_id),
    clienteId: txt(row.cliente_id),
    monto: num(row.monto),
    metodo: (row.metodo ?? "Efectivo") as MetodoPago,
    referencia: txt(row.referencia),
    fechaPago: fecha(row.fecha),
    observaciones: txt(row.observaciones),
    creadoPor: txt(row.creado_por),
    createdAt: txt(row.created_at),
  }
}

// Fila de la RPC listar_tecnicos_activos: solo id y nombre de técnicos activos.
export function mapTecnico(row: Record<string, any>): Tecnico {
  return {
    id: row.id,
    nombre: txt(row.nombre),
    activo: true,
  }
}

export function mapCampana(row: Record<string, any>): MarketingCampana {
  return {
    id: row.id,
    nombre: txt(row.nombre),
    plataforma: txt(row.plataforma),
    objetivo: txt(row.objetivo),
    servicio: txt(row.servicio),
    fechaInicio: fecha(row.fecha_inicio),
    fechaFin: fecha(row.fecha_fin),
    presupuesto: num(row.presupuesto),
    gastoReal: num(row.gasto_real),
    activa: row.activa ?? true,
    createdAt: txt(row.created_at),
  }
}

export function mapLead(row: Record<string, any>): Lead {
  return {
    id: row.id,
    nombre: txt(row.nombre),
    empresa: txt(row.empresa),
    telefono: txt(row.telefono),
    correo: txt(row.correo),
    ciudad: txt(row.ciudad),
    servicioInteres: txt(row.servicio_interes),
    descripcionNecesidad: txt(row.descripcion_necesidad),
    origen: txt(row.origen),
    medio: txt(row.medio),
    campanaId: row.campana_id ?? null,
    utmSource: txt(row.utm_source),
    utmMedium: txt(row.utm_medium),
    utmCampaign: txt(row.utm_campaign),
    utmContent: txt(row.utm_content),
    utmTerm: txt(row.utm_term),
    estado: (row.estado ?? "Nuevo") as EstadoLead,
    prioridad: (row.prioridad ?? "Normal") as PrioridadLead,
    asignadoA: row.asignado_a ?? null,
    clienteId: row.cliente_id ?? null,
    valorEstimado: row.valor_estimado == null ? null : num(row.valor_estimado),
    valorCerrado: row.valor_cerrado == null ? null : num(row.valor_cerrado),
    ultimoContacto: row.ultimo_contacto ?? null,
    proximoContacto: row.proximo_contacto ?? null,
    notas: txt(row.notas),
    creadoPor: row.creado_por ?? null,
    createdAt: txt(row.created_at),
  }
}

export function mapLeadActividad(row: Record<string, any>): LeadActividad {
  return {
    id: row.id,
    leadId: txt(row.lead_id),
    tipo: (row.tipo ?? "Nota") as TipoActividadLead,
    descripcion: txt(row.descripcion),
    usuarioId: row.usuario_id ?? null,
    createdAt: txt(row.created_at),
  }
}

// Fila de profiles (id, full_name, role, active, cliente_id). profiles no
// guarda el correo: llega aparte (auth.users) cuando se conoce.
// El técnico se identifica por su propio perfil: ordenes_servicio.tecnico_id
// guarda el id del perfil (las políticas RLS comparan con auth.uid()).
export function mapUsuario(row: Record<string, any>, email = ""): Usuario {
  const rol = (row.role ?? "consulta") as RolUsuario
  return {
    id: row.id,
    nombre: txt(row.full_name) || email,
    email,
    rol,
    activo: row.active ?? false,
    clienteId: row.cliente_id ?? null,
    tecnicoId: rol === "tecnico" ? row.id : null,
  }
}

// App -> DB ---------------------------------------------------------------

export function clienteToDb(data: Partial<Cliente>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.nombre !== undefined) out.nombre_empresa = data.nombre
  if (data.rfc !== undefined) out.rfc = data.rfc
  if (data.contacto !== undefined) out.contacto = data.contacto
  if (data.email !== undefined) out.correo = data.email
  if (data.telefono !== undefined) out.telefono = data.telefono
  if (data.direccion !== undefined) out.direccion = data.direccion
  if (data.ciudad !== undefined) out.ciudad = data.ciudad
  if (data.notas !== undefined) out.notas = data.notas
  return out
}

export function equipoToDb(data: Partial<Equipo>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.tipo !== undefined) out.tipo_equipo = data.tipo
  if (data.marca !== undefined) out.marca = data.marca
  if (data.modelo !== undefined) out.modelo = data.modelo
  if (data.numeroSerie !== undefined) out.numero_serie = data.numeroSerie
  if (data.capacidad !== undefined) out.capacidad = data.capacidad
  if (data.ubicacion !== undefined) out.ubicacion = data.ubicacion
  if (data.estado !== undefined) out.estado = data.estado
  if (data.fechaInstalacion !== undefined) out.fecha_instalacion = fecha(data.fechaInstalacion)
  if (data.fechaUltimoServicio !== undefined) out.fecha_ultimo_servicio = fecha(data.fechaUltimoServicio)
  if (data.fechaProximoServicio !== undefined) out.fecha_proximo_servicio = fecha(data.fechaProximoServicio)
  if (data.notas !== undefined) out.notas = data.notas
  return out
}

export function ordenToDb(data: Partial<OrdenServicio>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.equipoId !== undefined) out.equipo_id = data.equipoId || null
  if (data.fechaSolicitud !== undefined) out.fecha_solicitud = fecha(data.fechaSolicitud)
  if (data.fechaProgramada !== undefined) out.fecha_programada = fecha(data.fechaProgramada)
  if (data.fechaInicio !== undefined) out.fecha_inicio = fecha(data.fechaInicio)
  if (data.fechaCierre !== undefined) out.fecha_cierre = fecha(data.fechaCierre)
  if (data.tipoServicio !== undefined) out.tipo_servicio = data.tipoServicio
  if (data.prioridad !== undefined) out.prioridad = data.prioridad
  if (data.estado !== undefined) out.estado = data.estado
  if (data.descripcionFalla !== undefined) out.descripcion_falla = data.descripcionFalla
  if (data.diagnostico !== undefined) out.diagnostico = data.diagnostico
  if (data.trabajoRealizado !== undefined) out.trabajo_realizado = data.trabajoRealizado
  if (data.tecnicoId !== undefined) out.tecnico_id = data.tecnicoId || null
  if (data.materiales !== undefined) out.materiales = data.materiales
  if (data.materialesDetalle !== undefined) out.materiales_detalle = data.materialesDetalle
  if (data.evidencias !== undefined) out.evidencias = data.evidencias
  if (data.horasTrabajadas !== undefined) out.horas_trabajadas = data.horasTrabajadas
  if (data.observaciones !== undefined) out.observaciones = data.observaciones
  if (data.horaProgramada !== undefined) out.hora_programada = data.horaProgramada || null
  if (data.firmaCliente !== undefined) out.firma_cliente = data.firmaCliente
  if (data.firmaFecha !== undefined) out.firma_fecha = data.firmaFecha
  if (data.cerradaPor !== undefined) out.cerrada_por = data.cerradaPor || null
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  if (data.ticketId !== undefined) out.ticket_id = data.ticketId || null
  if (data.historial !== undefined) out.historial = data.historial
  return out
}

export function ticketToDb(data: Partial<Ticket>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.equipoId !== undefined) out.equipo_id = data.equipoId || null
  if (data.contacto !== undefined) out.contacto = data.contacto
  if (data.ubicacion !== undefined) out.ubicacion = data.ubicacion
  if (data.tipoServicio !== undefined) out.tipo_servicio = data.tipoServicio
  if (data.prioridad !== undefined) out.prioridad = data.prioridad
  if (data.estado !== undefined) out.estado = data.estado
  if (data.descripcionFalla !== undefined) out.descripcion_falla = data.descripcionFalla
  if (data.fechaSolicitud !== undefined) out.fecha_solicitud = fecha(data.fechaSolicitud)
  if (data.ordenId !== undefined) out.orden_id = data.ordenId || null
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  return out
}

export function cotizacionToDb(data: Partial<Cotizacion>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.equipoId !== undefined) out.equipo_id = data.equipoId || null
  if (data.contacto !== undefined) out.contacto = data.contacto
  if (data.conceptos !== undefined) out.conceptos = data.conceptos
  if (data.subtotal !== undefined) out.subtotal = data.subtotal
  if (data.descuento !== undefined) out.descuento = data.descuento
  if (data.iva !== undefined) out.iva = data.iva
  if (data.total !== undefined) out.total = data.total
  if (data.vigencia !== undefined) out.vigencia = fecha(data.vigencia)
  if (data.condiciones !== undefined) out.condiciones = data.condiciones
  if (data.observaciones !== undefined) out.observaciones = data.observaciones
  if (data.estado !== undefined) out.estado = data.estado
  if (data.ordenId !== undefined) out.orden_id = data.ordenId || null
  //if (data.leadId !== undefined) out.lead_id = data.leadId || null
  if (data.motivoRechazo !== undefined) out.motivo_rechazo = data.motivoRechazo || null
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  return out
}

export function facturaToDb(data: Partial<Factura>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.ordenId !== undefined) out.orden_id = data.ordenId || null
  if (data.cotizacionId !== undefined) out.cotizacion_id = data.cotizacionId || null
  if (data.conceptos !== undefined) out.conceptos = data.conceptos
  if (data.subtotal !== undefined) out.subtotal = data.subtotal
  if (data.descuento !== undefined) out.descuento = data.descuento
  if (data.iva !== undefined) out.iva = data.iva
  if (data.total !== undefined) out.total = data.total
  if (data.fechaEmision !== undefined) out.fecha = fecha(data.fechaEmision)
  if (data.fechaVencimiento !== undefined) out.fecha_vencimiento = fecha(data.fechaVencimiento)
  if (data.condiciones !== undefined) out.condiciones = data.condiciones
  if (data.observaciones !== undefined) out.observaciones = data.observaciones
  if (data.estado !== undefined) out.estado = data.estado
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  return out
}

export function pagoToDb(data: Partial<Pago>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.facturaId !== undefined) out.factura_id = data.facturaId || null
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.monto !== undefined) out.monto = data.monto
  if (data.metodo !== undefined) out.metodo = data.metodo
  if (data.referencia !== undefined) out.referencia = data.referencia
  if (data.fechaPago !== undefined) out.fecha = fecha(data.fechaPago)
  if (data.observaciones !== undefined) out.observaciones = data.observaciones
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  return out
}

export function campanaToDb(data: Partial<MarketingCampana>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.nombre !== undefined) out.nombre = data.nombre
  if (data.plataforma !== undefined) out.plataforma = data.plataforma || null
  if (data.objetivo !== undefined) out.objetivo = data.objetivo || null
  if (data.servicio !== undefined) out.servicio = data.servicio || null
  if (data.fechaInicio !== undefined) out.fecha_inicio = fecha(data.fechaInicio)
  if (data.fechaFin !== undefined) out.fecha_fin = fecha(data.fechaFin)
  if (data.presupuesto !== undefined) out.presupuesto = data.presupuesto
  if (data.gastoReal !== undefined) out.gasto_real = data.gastoReal
  if (data.activa !== undefined) out.activa = data.activa
  return out
}

export function leadToDb(data: Partial<Lead>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.nombre !== undefined) out.nombre = data.nombre
  if (data.empresa !== undefined) out.empresa = data.empresa || null
  if (data.telefono !== undefined) out.telefono = data.telefono || null
  if (data.correo !== undefined) out.correo = data.correo || null
  if (data.ciudad !== undefined) out.ciudad = data.ciudad || null
  if (data.servicioInteres !== undefined) out.servicio_interes = data.servicioInteres || null
  if (data.descripcionNecesidad !== undefined)
    out.descripcion_necesidad = data.descripcionNecesidad || null
  if (data.origen !== undefined) out.origen = data.origen || null
  if (data.medio !== undefined) out.medio = data.medio || null
  if (data.campanaId !== undefined) out.campana_id = data.campanaId || null
  if (data.utmSource !== undefined) out.utm_source = data.utmSource || null
  if (data.utmMedium !== undefined) out.utm_medium = data.utmMedium || null
  if (data.utmCampaign !== undefined) out.utm_campaign = data.utmCampaign || null
  if (data.utmContent !== undefined) out.utm_content = data.utmContent || null
  if (data.utmTerm !== undefined) out.utm_term = data.utmTerm || null
  if (data.estado !== undefined) out.estado = data.estado
  if (data.prioridad !== undefined) out.prioridad = data.prioridad
  if (data.asignadoA !== undefined) out.asignado_a = data.asignadoA || null
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.valorEstimado !== undefined) out.valor_estimado = data.valorEstimado
  if (data.valorCerrado !== undefined) out.valor_cerrado = data.valorCerrado
  if (data.ultimoContacto !== undefined) out.ultimo_contacto = data.ultimoContacto || null
  if (data.proximoContacto !== undefined) out.proximo_contacto = data.proximoContacto || null
  if (data.notas !== undefined) out.notas = data.notas || null
  if (data.creadoPor !== undefined) out.creado_por = data.creadoPor || null
  return out
}

export function leadActividadToDb(data: Partial<LeadActividad>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.leadId !== undefined) out.lead_id = data.leadId
  if (data.tipo !== undefined) out.tipo = data.tipo
  if (data.descripcion !== undefined) out.descripcion = data.descripcion || null
  if (data.usuarioId !== undefined) out.usuario_id = data.usuarioId || null
  return out
}

// ---------------------------------------------------------------------------
// FASE 3: mensajería de WhatsApp
// ---------------------------------------------------------------------------

const DIRECCION_A_APP: Record<string, DireccionMensaje> = {
  entrante: "Entrante",
  saliente: "Saliente",
}
const DIRECCION_A_DB: Record<DireccionMensaje, string> = {
  Entrante: "entrante",
  Saliente: "saliente",
}

const TIPO_MENSAJE_A_APP: Record<string, TipoMensajeWhatsApp> = {
  texto: "Texto",
  imagen: "Imagen",
  documento: "Documento",
  plantilla: "Plantilla",
  nota: "Nota",
}
const TIPO_MENSAJE_A_DB: Record<TipoMensajeWhatsApp, string> = {
  Texto: "texto",
  Imagen: "imagen",
  Documento: "documento",
  Plantilla: "plantilla",
  Nota: "nota",
}

const ESTADO_MENSAJE_A_APP: Record<string, EstadoMensajeWhatsApp> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  entregado: "Entregado",
  leido: "Leído",
  fallido: "Fallido",
  recibido: "Recibido",
}
const ESTADO_MENSAJE_A_DB: Record<EstadoMensajeWhatsApp, string> = {
  Pendiente: "pendiente",
  Enviado: "enviado",
  Entregado: "entregado",
  Leído: "leido",
  Fallido: "fallido",
  Recibido: "recibido",
}

export function mapMensajeWhatsApp(row: Record<string, any>): MensajeWhatsApp {
  return {
    id: row.id,
    leadId: row.lead_id ?? null,
    clienteId: row.cliente_id ?? null,
    telefono: row.telefono ?? "",
    direccion: DIRECCION_A_APP[row.direccion] ?? "Entrante",
    tipo: TIPO_MENSAJE_A_APP[row.tipo] ?? "Texto",
    mensaje: row.mensaje ?? "",
    mediaUrl: row.media_url ?? null,
    whatsappMessageId: row.whatsapp_message_id ?? null,
    estado: ESTADO_MENSAJE_A_APP[row.estado] ?? "Pendiente",
    notaInterna: row.nota_interna ?? false,
    leido: row.leido ?? false,
    enviadoPor: row.enviado_por ?? null,
    createdAt: row.created_at,
  }
}

export function mensajeWhatsAppToDb(data: Partial<MensajeWhatsApp>): Record<string, any> {
  const out: Record<string, any> = {}
  if (data.leadId !== undefined) out.lead_id = data.leadId || null
  if (data.clienteId !== undefined) out.cliente_id = data.clienteId || null
  if (data.telefono !== undefined) out.telefono = data.telefono
  if (data.direccion !== undefined) out.direccion = DIRECCION_A_DB[data.direccion]
  if (data.tipo !== undefined) out.tipo = TIPO_MENSAJE_A_DB[data.tipo]
  if (data.mensaje !== undefined) out.mensaje = data.mensaje || null
  if (data.mediaUrl !== undefined) out.media_url = data.mediaUrl || null
  if (data.whatsappMessageId !== undefined)
    out.whatsapp_message_id = data.whatsappMessageId || null
  if (data.estado !== undefined) out.estado = ESTADO_MENSAJE_A_DB[data.estado]
  if (data.notaInterna !== undefined) out.nota_interna = data.notaInterna
  if (data.leido !== undefined) out.leido = data.leido
  if (data.enviadoPor !== undefined) out.enviado_por = data.enviadoPor || null
  return out
}

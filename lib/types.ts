// Tipos de dominio de ZARAMAN SERVICIOS.
// Los nombres y campos están alineados con el esquema de Supabase
// (ver lib/mappers.ts para la conversión entre columnas y este modelo).

export type EstadoEquipo =
  | "Operativo"
  | "En reparación"
  | "Fuera de servicio"
  | "En espera de refacción"

export type EstadoOrden =
  | "Pendiente de asignación"
  | "Pendiente"
  | "Asignada"
  | "Programada"
  | "En camino"
  | "En proceso"
  | "En espera"
  | "Terminada"
  | "Cancelada"

export type TipoServicio =
  | "Preventivo"
  | "Correctivo"
  | "Emergencia"
  | "Instalación"
  | "Otro"

export type Prioridad = "Normal" | "Alta" | "Urgente"

export type PrioridadTicket = "Baja" | "Normal" | "Alta" | "Urgente"

export type EstadoTicket =
  | "Nuevo"
  | "Revisado"
  | "Asignado"
  | "En atención"
  | "Pendiente"
  | "Resuelto"
  | "Cerrado"
  | "Cancelado"

export type TipoConcepto =
  | "Mano de obra"
  | "Material"
  | "Refacción"
  | "Producto"
  | "Otro"

export type EstadoCotizacion =  
  | "Enviada"
  | "Vista"
  | "Aceptada"
  | "Rechazada"
  | "Vencida"

export type EstadoFactura =
  | "Pendiente"
  | "Emitida"
  | "Pagada"
  | "Parcialmente pagada"
  | "Cancelada"

export type MetodoPago =
  | "Efectivo"
  | "Transferencia"
  | "Cheque"
  | "Tarjeta de crédito"
  | "Tarjeta de débito"
  | "Otro"

// Valores tal como se guardan en profiles.role (CHECK de la base).
export type RolUsuario =
  | "administrador"
  | "supervisor"
  | "tecnico"
  | "consulta"
  | "cliente"

export interface Cliente {
  id: string
  nombre: string
  rfc: string
  contacto: string
  email: string
  telefono: string
  direccion: string
  ciudad: string
  notas: string
  createdAt: string
}

export interface Equipo {
  id: string
  clienteId: string
  tipo: string
  marca: string
  modelo: string
  numeroSerie: string
  capacidad: string
  ubicacion: string
  estado: EstadoEquipo
  fechaInstalacion: string
  fechaUltimoServicio: string | null
  fechaProximoServicio: string | null
  notas: string
}

export type FaseEvidencia = "Antes" | "Durante" | "Después"

export interface MaterialOrden {
  id: string
  descripcion: string
  codigo: string
  cantidad: number
  unidad: string
  precio: number
  observaciones: string
  tecnicoId: string | null
  fecha: string
}

export interface EvidenciaOrden {
  id: string
  url: string
  path: string
  fase: FaseEvidencia
  descripcion: string
  fecha: string
}

export interface OrdenServicio {
  id: string
  folio: string
  clienteId: string
  equipoId: string
  fechaSolicitud: string
  fechaProgramada: string | null
  horaProgramada: string | null
  fechaInicio: string | null
  fechaCierre: string | null
  tipoServicio: TipoServicio
  prioridad: Prioridad
  estado: EstadoOrden
  descripcionFalla: string
  diagnostico: string
  trabajoRealizado: string
  tecnicoId: string | null
  materiales: string
  materialesDetalle: MaterialOrden[]
  evidencias: EvidenciaOrden[]
  horasTrabajadas: number | null
  observaciones: string
  firmaCliente: string
  firmaFecha: string | null
  cerradaPor: string | null
  creadoPor: string
  ticketId: string | null
  historial: HistorialEvento[]
}

export interface HistorialEvento {
  estado: EstadoOrden
  fecha: string
  usuarioId: string
  usuarioNombre: string
}

export interface Ticket {
  id: string
  folio: string
  clienteId: string
  equipoId: string | null
  contacto: string
  ubicacion: string
  tipoServicio: TipoServicio
  prioridad: PrioridadTicket
  estado: EstadoTicket
  descripcionFalla: string
  fechaSolicitud: string
  ordenId: string | null
  creadoPor: string
}

export interface ConceptoCotizacion {
  descripcion: string
  tipo: TipoConcepto
  cantidad: number
  precioUnitario: number
  // Descuento por línea expresado en porcentaje (0-100).
  descuento: number
}

// Evento del historial de una cotización (enviada, vista, aceptada, rechazada…).
export interface HistorialCotizacion {
  evento: string
  fecha: string
  usuario: string
}

export interface Cotizacion {
  id: string
  folio: string
  clienteId: string
  equipoId: string | null
  contacto: string
  conceptos: ConceptoCotizacion[]
  subtotal: number
  descuento: number
  iva: number
  total: number
  vigencia: string | null
  condiciones: string
  observaciones: string
  estado: EstadoCotizacion
  ordenId: string | null
  // Lead de origen (opcional): cotización generada a partir de un lead calificado.
  leadId?: string | null
  // Campos de seguimiento del portal del cliente. Opcionales porque las
  // cotizaciones recién creadas desde el panel interno aún no los tienen.
  aceptadaEn?: string | null
  aceptadaPor?: string | null
  rechazadaEn?: string | null
  rechazadaPor?: string | null
  motivoRechazo?: string | null
  historial?: HistorialCotizacion[]
  creadoPor: string
  createdAt: string
}

export interface Factura {
  id: string
  folio: string
  clienteId: string
  ordenId: string | null
  cotizacionId: string | null
  conceptos: ConceptoCotizacion[]
  subtotal: number
  descuento: number
  iva: number
  total: number
  montoPagado: number
  saldo: number
  fechaEmision: string | null
  fechaVencimiento: string | null
  condiciones: string
  observaciones: string
  estado: EstadoFactura
  creadoPor: string
  createdAt: string
}

export interface Pago {
  id: string
  folio: string
  facturaId: string
  clienteId: string
  monto: number
  metodo: MetodoPago
  referencia: string
  fechaPago: string | null
  observaciones: string
  creadoPor: string
  createdAt: string
}

// Técnico = perfil con rol 'tecnico'. Se lista con la RPC
// listar_tecnicos_activos, que solo expone id y nombre.
export interface Tecnico {
  id: string
  nombre: string
  activo: boolean
}

export interface Usuario {
  id: string
  nombre: string
  email: string
  rol: RolUsuario
  activo: boolean
  clienteId: string | null
  tecnicoId: string | null
}

export const ESTADOS_ORDEN: EstadoOrden[] = [
  "Pendiente de asignación",
  "Pendiente",
  "Asignada",
  "Programada",
  "En camino",
  "En proceso",
  "En espera",
  "Terminada",
  "Cancelada",
]

export const TIPOS_SERVICIO: TipoServicio[] = [
  "Preventivo",
  "Correctivo",
  "Emergencia",
  "Instalación",
  "Otro",
]

export const PRIORIDADES: Prioridad[] = ["Normal", "Alta", "Urgente"]

export const PRIORIDADES_TICKET: PrioridadTicket[] = [
  "Baja",
  "Normal",
  "Alta",
  "Urgente",
]

export const ESTADOS_TICKET: EstadoTicket[] = [
  "Nuevo",
  "Revisado",
  "Asignado",
  "En atención",
  "Pendiente",
  "Resuelto",
  "Cerrado",
  "Cancelado",
]

export const TIPOS_CONCEPTO: TipoConcepto[] = [
  "Mano de obra",
  "Material",
  "Refacción",
  "Producto",
  "Otro",
]

export const ESTADOS_COTIZACION: EstadoCotizacion[] = [
  "Enviada",
  "Vista",
  "Aceptada",
  "Rechazada",
  "Vencida",
]

export const ESTADOS_FACTURA: EstadoFactura[] = [
  "Pendiente",
  "Emitida",
  "Pagada",
  "Parcialmente pagada",
  "Cancelada",
]

export const METODOS_PAGO: MetodoPago[] = [
  "Efectivo",
  "Transferencia",
  "Cheque",
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "Otro",
]

export const ESTADOS_EQUIPO: EstadoEquipo[] = [
  "Operativo",
  "En reparación",
  "Fuera de servicio",
  "En espera de refacción",
]

export const UNIDADES_MATERIAL: string[] = [
  "Pieza",
  "Metro",
  "Litro",
  "Kilogramo",
  "Caja",
  "Juego",
  "Servicio",
]

export const FASES_EVIDENCIA: FaseEvidencia[] = ["Antes", "Durante", "Después"]

// Roles que el administrador puede asignar a una cuenta.
export const ROLES_USUARIO: RolUsuario[] = [
  "administrador",
  "supervisor",
  "tecnico",
  "consulta",
  "cliente",
]

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  tecnico: "Técnico",
  consulta: "Consulta",
  cliente: "Cliente",
}

// ---------------------------------------------------------------------------
// FASE 1 — CRM de leads y marketing
// ---------------------------------------------------------------------------

// Etapas del embudo de ventas de un lead.
export type EstadoLead =
  | "Nuevo"
  | "Contactado"
  | "Calificado"
  | "Propuesta"
  | "Ganado"
  | "Perdido"

export type PrioridadLead = "Baja" | "Normal" | "Alta"

// Canal de origen desde el que llegó el lead.
export type OrigenLead =
  | "Facebook"
  | "Instagram"
  | "Google"
  | "WhatsApp"
  | "Sitio web"
  | "Referido"
  | "Llamada"
  | "Otro"

// Plataforma publicitaria de una campaña de marketing.
export type PlataformaCampana =
  | "Facebook Ads"
  | "Instagram"
  | "Google Ads"
  | "TikTok"
  | "Email"
  | "LinkedIn"
  | "Otro"

// Tipo de interacción registrada en la bitácora de un lead.
export type TipoActividadLead =
  | "Nota"
  | "Llamada"
  | "Correo"
  | "WhatsApp"
  | "Reunión"
  | "Cambio de estado"

export interface MarketingCampana {
  id: string
  nombre: string
  plataforma: string
  objetivo: string
  servicio: string
  fechaInicio: string | null
  fechaFin: string | null
  presupuesto: number
  gastoReal: number
  activa: boolean
  createdAt: string
}

export interface Lead {
  id: string
  nombre: string
  empresa: string
  telefono: string
  correo: string
  ciudad: string
  servicioInteres: string
  descripcionNecesidad: string
  origen: string
  medio: string
  campanaId: string | null
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string
  utmTerm: string
  estado: EstadoLead
  prioridad: PrioridadLead
  asignadoA: string | null
  clienteId: string | null
  valorEstimado: number | null
  valorCerrado: number | null
  ultimoContacto: string | null
  proximoContacto: string | null
  notas: string
  creadoPor: string | null
  createdAt: string
}

export interface LeadActividad {
  id: string
  leadId: string
  tipo: TipoActividadLead
  descripcion: string
  usuarioId: string | null
  createdAt: string
}

export const ESTADOS_LEAD: EstadoLead[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Propuesta",
  "Ganado",
  "Perdido",
]

// Etapas visibles en el tablero kanban (excluye estados finales de cierre
// para mantener el foco en el pipeline activo, aunque "Ganado"/"Perdido"
// también se muestran como columnas de cierre).
export const ETAPAS_PIPELINE: EstadoLead[] = [
  "Nuevo",
  "Contactado",
  "Calificado",
  "Propuesta",
  "Ganado",
  "Perdido",
]

export const PRIORIDADES_LEAD: PrioridadLead[] = ["Baja", "Normal", "Alta"]

export const ORIGENES_LEAD: OrigenLead[] = [
  "Facebook",
  "Instagram",
  "Google",
  "WhatsApp",
  "Sitio web",
  "Referido",
  "Llamada",
  "Otro",
]

export const PLATAFORMAS_CAMPANA: PlataformaCampana[] = [
  "Facebook Ads",
  "Instagram",
  "Google Ads",
  "TikTok",
  "Email",
  "LinkedIn",
  "Otro",
]

export const TIPOS_ACTIVIDAD_LEAD: TipoActividadLead[] = [
  "Nota",
  "Llamada",
  "Correo",
  "WhatsApp",
  "Reunión",
  "Cambio de estado",
]

// ---------------------------------------------------------------------------
// FASE 3: mensajería de WhatsApp
// ---------------------------------------------------------------------------

export type DireccionMensaje = "Entrante" | "Saliente"

export type TipoMensajeWhatsApp =
  | "Texto"
  | "Imagen"
  | "Documento"
  | "Plantilla"
  | "Nota"

export type EstadoMensajeWhatsApp =
  | "Pendiente"
  | "Enviado"
  | "Entregado"
  | "Leído"
  | "Fallido"
  | "Recibido"

export interface MensajeWhatsApp {
  id: string
  leadId: string | null
  clienteId: string | null
  telefono: string
  direccion: DireccionMensaje
  tipo: TipoMensajeWhatsApp
  mensaje: string
  mediaUrl: string | null
  whatsappMessageId: string | null
  estado: EstadoMensajeWhatsApp
  notaInterna: boolean
  leido: boolean
  enviadoPor: string | null
  createdAt: string
}

// Conversación agrupada por número de teléfono para la bandeja de entrada.
export interface ConversacionWhatsApp {
  telefono: string
  leadId: string | null
  clienteId: string | null
  nombre: string
  ultimoMensaje: string
  ultimaFecha: string
  noLeidos: number
  mensajes: MensajeWhatsApp[]
}

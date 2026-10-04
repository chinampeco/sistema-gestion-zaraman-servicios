// Modelo central de permisos por rol para ZARAMAN SERVICIOS.
//
// Este módulo NO importa nada del cliente de Supabase ni de React, para que
// pueda usarse tanto en el servidor (middleware/proxy) como en el cliente
// (sidebar, ocultar acciones). Es la única fuente de verdad de qué puede ver
// y hacer cada rol.

import type { RolUsuario } from "@/lib/types"

export type ClaveModulo =
  | "dashboard"
  | "leads"
  | "marketing"
  | "whatsapp"
  | "clientes"
  | "equipos"
  | "inventario"
  | "tickets"
  | "cotizaciones"
  | "ordenes"
  | "agenda"
  | "tecnicos"
  | "facturacion"
  | "cobranza"
  | "reportes"
  | "configuracion"
  | "notificaciones"

// Ruta base de cada módulo del panel.
export const RUTA_MODULO: Record<ClaveModulo, string> = {
  dashboard: "/",
  leads: "/leads",
  marketing: "/marketing",
  whatsapp: "/whatsapp",
  clientes: "/clientes",
  equipos: "/equipos",
  inventario: "/inventario",
  tickets: "/tickets",
  cotizaciones: "/cotizaciones",
  ordenes: "/ordenes",
  agenda: "/agenda",
  tecnicos: "/tecnicos",
  facturacion: "/facturas",
  cobranza: "/cobranza",
  reportes: "/reportes",
  configuracion: "/configuracion",
  notificaciones: "/notificaciones",
}

type RolInterno = Exclude<RolUsuario, "cliente">

// Módulos que puede ver cada rol interno.
const MODULOS_POR_ROL: Record<RolInterno, ClaveModulo[]> = {
  administrador: [
    "dashboard",
    "leads",
    "marketing",
    "whatsapp",
    "clientes",
    "equipos",
    "inventario",
    "tickets",
    "cotizaciones",
    "ordenes",
    "agenda",
    "tecnicos",
    "facturacion",
    "cobranza",
    "reportes",
    "configuracion",
    "notificaciones",
  ],
  supervisor: [
    "dashboard",
    "leads",
    "marketing",
    "whatsapp",
    "clientes",
    "equipos",
    "inventario",
    "tickets",
    "cotizaciones",
    "ordenes",
    "agenda",
    "tecnicos",
    "reportes",
    "configuracion",
    "notificaciones",
  ],
  // El técnico trabaja en campo: solo sus órdenes, su agenda y avisos.
  // No ve el dashboard general (resumen financiero/operativo de la empresa).
  tecnico: ["ordenes", "agenda", "notificaciones", "configuracion"],
  // Consulta ve casi todo, pero en modo de solo lectura (ver puedeEditar).
  // No ve Técnicos: la lista de técnicos solo la pueden consultar
  // administrador y supervisor (RPC listar_tecnicos_activos).
  consulta: [
    "dashboard",
    "leads",
    "marketing",
    "whatsapp",
    "clientes",
    "equipos",
    "inventario",
    "tickets",
    "cotizaciones",
    "ordenes",
    "agenda",
    "facturacion",
    "cobranza",
    "reportes",
    "configuracion",
    "notificaciones",
  ],
}

export function modulosDeRol(rol: RolUsuario): ClaveModulo[] {
  if (rol === "cliente") return []
  return MODULOS_POR_ROL[rol] ?? []
}

export function puedeVerModulo(rol: RolUsuario, modulo: ClaveModulo): boolean {
  return modulosDeRol(rol).includes(modulo)
}

// ¿El rol tiene acceso a la ruta indicada del panel?
export function puedeAccederRuta(rol: RolUsuario, pathname: string): boolean {
  if (rol === "cliente") return false
  const modulos = modulosDeRol(rol)
  if (pathname === "/") return modulos.includes("dashboard")
  return modulos.some((m) => {
    const base = RUTA_MODULO[m]
    if (base === "/") return false
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

// Pantalla de espera para cuentas sin acceso al panel: perfiles inactivos o
// sin perfil, y usuarios cliente mientras el portal no esté disponible.
export const RUTA_CUENTA_PENDIENTE = "/auth/pendiente"

// Ruta a la que se envía a cada rol tras iniciar sesión o al intentar entrar
// a una sección no permitida.
export function rutaInicioRol(rol: RolUsuario): string {
  if (rol === "cliente") return RUTA_CUENTA_PENDIENTE
  const modulos = modulosDeRol(rol)
  if (modulos.includes("dashboard")) return "/"
  const primero = modulos.find((m) => RUTA_MODULO[m] !== "/")
  return primero ? RUTA_MODULO[primero] : "/"
}

// Solo el Administrador gestiona usuarios y accesos.
export function puedeGestionarUsuarios(rol: RolUsuario): boolean {
  return rol === "administrador"
}

// Asignar o reasignar una orden a un técnico: administración y supervisión.
// Coincide con los roles que acepta la RPC asignar_orden_con_garantia_v2 y
// listar_tecnicos_activos.
export function puedeReasignarOrdenes(rol: RolUsuario): boolean {
  return rol === "administrador" || rol === "supervisor"
}

// Consulta y Cliente no pueden crear/editar/eliminar (solo lectura).
export function puedeEditar(rol: RolUsuario): boolean {
  return rol !== "consulta" && rol !== "cliente"
}

export function esSoloLectura(rol: RolUsuario): boolean {
  return rol === "consulta"
}

// Descripción corta de cada rol para mostrar en la gestión de usuarios.
export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  administrador: "Acceso total, incluida la gestión de usuarios y la configuración.",
  supervisor: "Operación y supervisión de técnicos. Sin finanzas.",
  tecnico: "Solo sus órdenes de servicio y su agenda.",
  consulta: "Acceso de solo lectura al panel.",
  cliente: "Acceso de su empresa al portal de clientes (disponible próximamente).",
}

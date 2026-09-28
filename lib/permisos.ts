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

type RolInterno = Exclude<RolUsuario, "Cliente">

// Módulos que puede ver cada rol interno.
const MODULOS_POR_ROL: Record<RolInterno, ClaveModulo[]> = {
  Administrador: [
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
  Coordinador: [
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
  Supervisor: [
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
  Técnico: ["ordenes", "agenda", "notificaciones", "configuracion"],
  // Consulta ve casi todo, pero en modo de solo lectura (ver puedeEditar).
  Consulta: [
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
}

export function modulosDeRol(rol: RolUsuario): ClaveModulo[] {
  if (rol === "Cliente") return []
  return MODULOS_POR_ROL[rol] ?? []
}

export function puedeVerModulo(rol: RolUsuario, modulo: ClaveModulo): boolean {
  return modulosDeRol(rol).includes(modulo)
}

// ¿El rol tiene acceso a la ruta indicada del panel?
export function puedeAccederRuta(rol: RolUsuario, pathname: string): boolean {
  if (rol === "Cliente") return false
  const modulos = modulosDeRol(rol)
  if (pathname === "/") return modulos.includes("dashboard")
  return modulos.some((m) => {
    const base = RUTA_MODULO[m]
    if (base === "/") return false
    return pathname === base || pathname.startsWith(`${base}/`)
  })
}

// Ruta a la que se envía a cada rol tras iniciar sesión o al intentar entrar
// a una sección no permitida.
export function rutaInicioRol(rol: RolUsuario): string {
  if (rol === "Cliente") return "/portal"
  const modulos = modulosDeRol(rol)
  if (modulos.includes("dashboard")) return "/"
  const primero = modulos.find((m) => RUTA_MODULO[m] !== "/")
  return primero ? RUTA_MODULO[primero] : "/"
}

// Solo el Administrador gestiona usuarios internos y accesos.
export function puedeGestionarUsuarios(rol: RolUsuario): boolean {
  return rol === "Administrador"
}

// Reasignar una orden a otro técnico: coordinación y supervisión.
// El técnico y el rol de solo lectura no pueden reasignar.
export function puedeReasignarOrdenes(rol: RolUsuario): boolean {
  return rol === "Administrador" || rol === "Coordinador" || rol === "Supervisor"
}

// Consulta y Cliente no pueden crear/editar/eliminar (solo lectura).
export function puedeEditar(rol: RolUsuario): boolean {
  return rol !== "Consulta" && rol !== "Cliente"
}

export function esSoloLectura(rol: RolUsuario): boolean {
  return rol === "Consulta"
}

// Descripción corta de cada rol para mostrar en la gestión de usuarios.
export const DESCRIPCION_ROL: Record<RolInterno, string> = {
  Administrador: "Acceso total, incluida la gestión de usuarios y la configuración.",
  Coordinador: "Operación completa, finanzas y reportes. Sin gestión de usuarios.",
  Supervisor: "Operación y supervisión de técnicos. Sin finanzas.",
  Técnico: "Solo sus órdenes de servicio y su agenda.",
  Consulta: "Acceso de solo lectura a todo el panel.",
}

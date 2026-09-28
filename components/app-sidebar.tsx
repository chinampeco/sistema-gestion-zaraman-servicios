"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Wrench,
  ClipboardList,
  HardHat,
  BarChart3,
  Settings,
  Factory,
  Ticket,
  CalendarDays,
  FileText,
  Receipt,
  Wallet,
  Megaphone,
  UserPlus,
  MessageCircle,
  Boxes,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useStore } from "@/lib/store"
import { type ClaveModulo, puedeVerModulo } from "@/lib/permisos"

type NavItem = {
  title: string
  href: string
  icon: typeof LayoutDashboard
  modulo: ClaveModulo
}

const navPrincipal: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Clientes", href: "/clientes", icon: Users, modulo: "clientes" },
  { title: "Equipos", href: "/equipos", icon: Wrench, modulo: "equipos" },
  { title: "Inventario", href: "/inventario", icon: Boxes, modulo: "inventario" },
  { title: "Tickets", href: "/tickets", icon: Ticket, modulo: "tickets" },
  { title: "Cotizaciones", href: "/cotizaciones", icon: FileText, modulo: "cotizaciones" },
  { title: "Órdenes de servicio", href: "/ordenes", icon: ClipboardList, modulo: "ordenes" },
  { title: "Agenda", href: "/agenda", icon: CalendarDays, modulo: "agenda" },
  { title: "Técnicos", href: "/tecnicos", icon: HardHat, modulo: "tecnicos" },
]

const navMarketing: NavItem[] = [
  { title: "Leads", href: "/leads", icon: UserPlus, modulo: "leads" },
  { title: "Campañas", href: "/marketing", icon: Megaphone, modulo: "marketing" },
  { title: "WhatsApp", href: "/whatsapp", icon: MessageCircle, modulo: "whatsapp" },
]

const navFinanzas: NavItem[] = [
  { title: "Facturación", href: "/facturas", icon: Receipt, modulo: "facturacion" },
  { title: "Cobranza", href: "/cobranza", icon: Wallet, modulo: "cobranza" },
]

const navGestion: NavItem[] = [
  { title: "Reportes", href: "/reportes", icon: BarChart3, modulo: "reportes" },
  { title: "Configuración", href: "/configuracion", icon: Settings, modulo: "configuracion" },
]

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { usuarioActual } = useStore()
  const { isMobile, setOpenMobile } = useSidebar()

  function handleNavigate() {
    if (isMobile) setOpenMobile(false)
  }

  const rol = usuarioActual.rol
  const principal = navPrincipal.filter((item) => puedeVerModulo(rol, item.modulo))
  const marketing = navMarketing.filter((item) => puedeVerModulo(rol, item.modulo))
  const finanzas = navFinanzas.filter((item) => puedeVerModulo(rol, item.modulo))
  const gestion = navGestion.filter((item) => puedeVerModulo(rol, item.modulo))

  function renderItem(item: NavItem) {
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={isActivePath(pathname, item.href)}
          tooltip={item.title}
          onClick={handleNavigate}
          render={<Link href={item.href} />}
        >
          <item.icon />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Factory className="size-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide">
              ZARAMAN
            </span>
            <span className="text-xs text-sidebar-foreground/70">
              Servicios Industriales
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {principal.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Operación</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{principal.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {marketing.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Marketing y ventas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{marketing.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {finanzas.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Finanzas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{finanzas.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {gestion.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestión</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{gestion.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {usuarioActual.nombre
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium">
              {usuarioActual.nombre}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/70">
              {usuarioActual.rol}
            </span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

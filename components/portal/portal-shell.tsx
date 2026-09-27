"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { CircleUserRound, ClipboardList, FileText, LayoutDashboard, LogOut, Receipt, Ticket, User, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

const NAV = [
  { href: "/portal", label: "Inicio", icon: LayoutDashboard },
  { href: "/portal/ordenes", label: "Órdenes", icon: ClipboardList },
  { href: "/portal/equipos", label: "Equipos", icon: Wrench },
  { href: "/portal/cotizaciones", label: "Cotizaciones", icon: FileText },
  { href: "/portal/facturas", label: "Facturas", icon: Receipt },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket },
  { href: "/portal/perfil", label: "Mi cuenta", icon: User },
]

export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { usuarioActual } = useStore()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wrench className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight">ZARAMAN SERVICIOS</span>
            <Badge variant="outline" className="hidden sm:inline-flex">
              Portal de clientes
            </Badge>
          </div>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <CircleUserRound className="size-5 text-muted-foreground" />
                    <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
                      {usuarioActual.nombre}
                    </span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-medium">{usuarioActual.nombre}</span>
                      <span className="text-xs font-normal text-muted-foreground">{usuarioActual.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={cerrarSesion}>
                    <LogOut />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="mx-auto w-full max-w-6xl overflow-x-auto px-2">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const activo = item.href === "/portal" ? pathname === item.href : pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                      activo
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}

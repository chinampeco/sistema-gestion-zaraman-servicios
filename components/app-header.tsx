"use client"

import { Bell, Building2, Check, ChevronsUpDown, CircleUserRound, LogOut } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
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
import { contarNotificaciones } from "@/lib/notificaciones"
import { createClient } from "@/lib/supabase/client"

export function AppHeader() {
  const router = useRouter()
  const { usuarioActual, ordenes, tickets, cotizaciones, facturas, empresas, empresaActiva, cambiarEmpresa } =
    useStore()

  const totalNotificaciones = contarNotificaciones(
    { ordenes, tickets, cotizaciones, facturas },
    usuarioActual.rol,
  )

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />
      {/* Empresa activa; con más de una asignada, el menú permite cambiarla. */}
      {empresas.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-9 min-w-0 gap-2 px-2">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-base font-semibold tracking-tight">
                  {empresaActiva?.nombreComercial ?? "Selecciona empresa"}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Cambiar de empresa</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {empresas.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  onClick={() => e.id !== empresaActiva?.id && cambiarEmpresa(e.id)}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{e.nombreComercial}</span>
                    <span className="truncate text-xs text-muted-foreground">{e.razonSocial}</span>
                  </div>
                  {e.id === empresaActiva?.id && <Check className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold tracking-tight text-foreground">
            {empresaActiva?.nombreComercial ?? "ZARAMAN"}
          </span>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {empresaActiva?.razonSocial ?? "S.A. de C.V."}
          </Badge>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          render={<Link href="/notificaciones" />}
          nativeButton={false}
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${totalNotificaciones > 0 ? ` (${totalNotificaciones} pendientes)` : ""}`}
        >
          <Bell />
          {totalNotificaciones > 0 && (
            <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {totalNotificaciones > 9 ? "9+" : totalNotificaciones}
            </span>
          )}
        </Button>
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <CircleUserRound className="size-5 text-muted-foreground" />
                <div className="hidden flex-col items-start leading-none sm:flex">
                  <span className="text-sm font-medium">{usuarioActual.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {usuarioActual.email}
                  </span>
                </div>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{usuarioActual.nombre}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {usuarioActual.rol}
                  </span>
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
    </header>
  )
}

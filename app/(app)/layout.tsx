import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { RUTA_CUENTA_PENDIENTE } from "@/lib/permisos"
import { StoreProvider } from "@/lib/store"
import { createClient } from "@/lib/supabase/server"

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Solo personal interno activo entra al panel. Las cuentas sin perfil,
  // inactivas o de cliente esperan en la pantalla de cuenta pendiente.
  const { data: perfil } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle()
  if (!perfil || perfil.active !== true || perfil.role === "cliente") {
    redirect(RUTA_CUENTA_PENDIENTE)
  }

  return (
    <StoreProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </StoreProvider>
  )
}

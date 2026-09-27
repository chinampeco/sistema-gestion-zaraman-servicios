import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
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

  // Los usuarios con rol "Cliente" pertenecen al portal, no al panel interno.
  const { data: perfil } = await supabase.from("profiles").select("rol").eq("id", user.id).single()
  if (perfil?.rol === "Cliente") {
    redirect("/portal")
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

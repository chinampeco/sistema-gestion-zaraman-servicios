import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { Toaster } from "@/components/ui/sonner"
import { StoreProvider } from "@/lib/store"
import { PortalShell } from "@/components/portal/portal-shell"
import { createClient } from "@/lib/supabase/server"

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Solo los usuarios con rol "Cliente" acceden al portal; el personal va al panel interno.
  const { data: perfil } = await supabase.from("profiles").select("rol").eq("id", user.id).single()
  if (perfil?.rol !== "Cliente") {
    redirect("/")
  }

  return (
    <StoreProvider>
      <PortalShell>{children}</PortalShell>
      <Toaster />
    </StoreProvider>
  )
}

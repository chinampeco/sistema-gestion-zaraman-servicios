"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export function CerrarSesionButton({ className }: { className?: string }) {
  const router = useRouter()

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <Button variant="outline" className={className} onClick={cerrarSesion}>
      Cerrar sesión
    </Button>
  )
}

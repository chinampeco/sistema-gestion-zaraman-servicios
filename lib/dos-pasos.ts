// Verificación en dos pasos (código de 6 dígitos de una app autenticadora:
// Google Authenticator, Microsoft Authenticator, Authy…). Obligatoria para los
// roles que administran usuarios, contratos y la operación.
import type { SupabaseClient } from "@supabase/supabase-js"

import type { RolUsuario } from "@/lib/types"

export const ROLES_CON_DOS_PASOS: readonly RolUsuario[] = ["Administrador", "Coordinador"]

export const RUTA_DOS_PASOS = "/auth/verificacion"

export function requiereDosPasos(rol: string | null | undefined): boolean {
  return !!rol && (ROLES_CON_DOS_PASOS as readonly string[]).includes(rol)
}

/** true si la sesión ya pasó la verificación en dos pasos (nivel aal2). */
export async function sesionVerificada(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return data?.currentLevel === "aal2"
}

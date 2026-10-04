// Utilidades de teléfono para WhatsApp. Sin dependencias de servidor, para que
// la bandeja (cliente) y las rutas API comparen los números igual.
//
// México: Meta entrega los celulares como 521 + 10 dígitos, mientras que en
// leads y clientes el teléfono suele capturarse con 10 dígitos y formato libre
// ("55 1234 5678", "+52 55…"). Por eso la comparación usa los últimos 10 dígitos.

/** Solo los dígitos del número. */
export function soloDigitos(telefono: string | null | undefined): string {
  return (telefono ?? "").replace(/\D/g, "")
}

/** Clave de comparación: últimos 10 dígitos. Vacía si el número es demasiado corto. */
export function claveTelefono(telefono: string | null | undefined): string {
  const digitos = soloDigitos(telefono)
  return digitos.length >= 10 ? digitos.slice(-10) : ""
}

/** ¿Dos teléfonos corresponden al mismo número? */
export function mismoTelefono(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = claveTelefono(a)
  return ka !== "" && ka === claveTelefono(b)
}

/**
 * Número en el formato que espera la Cloud API: internacional, sin "+" ni
 * espacios. Un número de 10 dígitos se toma como mexicano (prefijo 52); los
 * demás se dejan tal cual, incluido el 521 + 10 dígitos que entrega Meta, para
 * responder al mismo wa_id. Devuelve null si no es un número válido.
 */
export function normalizarTelefonoEnvio(telefono: string | null | undefined): string | null {
  let digitos = soloDigitos(telefono)
  if (digitos.startsWith("00")) digitos = digitos.slice(2)
  if (digitos.length === 10) digitos = `52${digitos}`
  if (digitos.length < 11 || digitos.length > 15) return null
  return digitos
}

/**
 * Patrón ILIKE para preseleccionar en la base teléfonos que terminan en los
 * mismos 4 dígitos, sin importar espacios o guiones ("%5%6%7%8"). El filtro
 * exacto por claveTelefono se hace después en código.
 */
export function patronUltimosDigitos(telefono: string): string {
  return `%${claveTelefono(telefono).slice(-4).split("").join("%")}`
}

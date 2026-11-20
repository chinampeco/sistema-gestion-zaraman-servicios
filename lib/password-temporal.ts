/** Contraseña temporal aleatoria (10 caracteres sin letras ni números que se confundan). */
export function generarPasswordTemporal(longitud = 10): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
  const valores = new Uint32Array(longitud)
  crypto.getRandomValues(valores)
  return Array.from(valores, (v) => chars[v % chars.length]).join("")
}

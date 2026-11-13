import { CAMPOS_UBICACION, type Ubicacion } from "@/lib/types"

export const UBICACION_VACIA: Ubicacion = { region: "", zona: "", instalacion: "", area: "" }

/** Filtro de listados: "" significa "todas". */
export type FiltroUbicacion = Ubicacion

export function tieneUbicacion(u: Ubicacion): boolean {
  return CAMPOS_UBICACION.some(({ clave }) => u[clave].trim() !== "")
}

/** Texto corto para listados: "I Región Militar · 1/a. Zona Militar · CEMICSA · Alberca". */
export function resumenUbicacion(u: Ubicacion): string {
  return CAMPOS_UBICACION.map(({ clave }) => u[clave].trim())
    .filter(Boolean)
    .join(" · ")
}

const normalizar = (s: string) =>
  s.trim().toLocaleLowerCase("es-MX").normalize("NFD").replace(/[̀-ͯ]/g, "")

/** Coincidencia sin distinguir mayúsculas ni acentos. */
export function coincideUbicacion(item: Ubicacion, filtro: FiltroUbicacion): boolean {
  return CAMPOS_UBICACION.every(
    ({ clave }) => !filtro[clave] || normalizar(item[clave]) === normalizar(filtro[clave]),
  )
}

/**
 * Valores distintos de un nivel, respetando los niveles anteriores ya
 * elegidos (la zona solo muestra zonas de la región elegida, etc.).
 */
export function opcionesUbicacion(
  items: Ubicacion[],
  clave: keyof Ubicacion,
  filtro: FiltroUbicacion,
): string[] {
  const indice = CAMPOS_UBICACION.findIndex((c) => c.clave === clave)
  const anteriores = CAMPOS_UBICACION.slice(0, indice)
  const vistos = new Map<string, string>()
  for (const item of items) {
    const valor = item[clave].trim()
    if (!valor) continue
    const ok = anteriores.every(
      (c) => !filtro[c.clave] || normalizar(item[c.clave]) === normalizar(filtro[c.clave]),
    )
    if (ok && !vistos.has(normalizar(valor))) vistos.set(normalizar(valor), valor)
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es-MX", { numeric: true }))
}

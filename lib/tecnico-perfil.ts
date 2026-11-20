// Perfil del técnico: lo arma la IA con su expediente (CV, cédula,
// certificaciones…) y el usuario lo corrige. Se usa para sugerir al técnico
// más apto al asignar una orden. Lo usan cliente y servidor.

export interface PerfilTecnico {
  /** Especialidades y habilidades (p. ej. "bombas de calor", "transformadores"). */
  especialidades: string[]
  /** Tipos de equipo que ha atendido (p. ej. "chiller", "planta de emergencia"). */
  equipos: string[]
  marcas: string[]
  certificaciones: string[]
  estudios: string
  aniosExperiencia: number | null
  resumen: string
}

export const PERFIL_VACIO: PerfilTecnico = {
  especialidades: [],
  equipos: [],
  marcas: [],
  certificaciones: [],
  estudios: "",
  aniosExperiencia: null,
  resumen: "",
}

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean))].slice(0, 40) : []
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export function normalizarPerfil(raw: any): PerfilTecnico {
  const anios = Number(raw?.aniosExperiencia ?? raw?.anios_experiencia)
  return {
    especialidades: lista(raw?.especialidades),
    equipos: lista(raw?.equipos),
    marcas: lista(raw?.marcas),
    certificaciones: lista(raw?.certificaciones),
    estudios: texto(raw?.estudios).slice(0, 300),
    aniosExperiencia: Number.isFinite(anios) && anios >= 0 && anios < 70 ? Math.round(anios) : null,
    resumen: texto(raw?.resumen).slice(0, 600),
  }
}

export function perfilVacio(p: PerfilTecnico): boolean {
  return !p.especialidades.length && !p.equipos.length && !p.marcas.length && !p.certificaciones.length && !p.resumen
}

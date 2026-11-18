// Datos de la hoja de orden de servicio imprimible (formato de cada empresa).
// Los entrega /api/ordenes/[id]/hoja a quien puede ver la orden: personal de la
// empresa, el técnico asignado o el cliente dueño de la orden.

export interface HojaEquipo {
  descripcion: string
  marca: string
  modelo: string
  serie: string
  inventario: string
  realizado: boolean
}

export interface HojaActividad {
  numero: number
  titulo: string
  detalle: string[]
  realizada: boolean
}

export interface HojaOrden {
  empresa: {
    clave: string
    nombreComercial: string
    razonSocial: string
    rfc: string
    domicilio: string
    telefono: string
    email: string
    representanteLegal: string
    representanteCargo: string
    giro: string
    /** Firma impresa del representante legal (imagen), si la empresa la tiene. */
    firmaRepresentante: string
  }
  orden: {
    id: string
    folio: string
    referencia: string
    estado: string
    fecha: string | null
    descripcion: string
    trabajoRealizado: string
    observaciones: string
    region: string
    zona: string
    instalacion: string
    area: string
  }
  cliente: { nombre: string; direccion: string; dependencia: string }
  contrato: { numero: string; objeto: string; garantiaCalidadMeses: number | null } | null
  partida: { numero: number; descripcion: string; nombreProyecto: string; fichaTecnica: string } | null
  equipos: HojaEquipo[]
  actividades: HojaActividad[]
  tecnico: string
  firmas: {
    tecnico: string
    tecnicoFecha: string | null
    areaUsuaria: string
    areaUsuariaNombre: string
    areaUsuariaFecha: string | null
    areaTecnica: string
    areaTecnicaNombre: string
    areaTecnicaFecha: string | null
  }
  /** Fotos de evidencia del servicio (anexo gráfico). */
  evidencias: { url: string; descripcion: string; fase: string }[]
  /** Hay escaneo firmado para descargar (órdenes de historial). */
  documentoFirmado: { nombre: string } | null
}

/** Fecha corta dd/mm/aaaa. */
export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ""
  const [a, m, d] = iso.slice(0, 10).split("-")
  return a && m && d ? `${d}/${m}/${a}` : ""
}

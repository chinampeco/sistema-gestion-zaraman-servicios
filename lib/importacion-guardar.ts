// Al confirmar la revisión se crean, con la sesión del usuario (RLS):
// cliente (si es nuevo) → contrato → partidas → equipos → órdenes (una por
// partida, con sus equipos) → garantías → expediente (se copian los archivos
// de la carpeta temporal a la del contrato) y se borra la carpeta temporal.

import type { SupabaseClient } from "@supabase/supabase-js"

import { BUCKET_EXPEDIENTES, contratoToDb, nombreArchivoSeguro, partidaToDb } from "@/lib/contratos"
import type { ExtraccionContrato } from "@/lib/importacion-contratos"
import { referenciaOrden } from "@/lib/importacion-contratos"

export interface ArchivoLote {
  indice: number
  nombre: string
  tipo: string
  tamano: number
  ruta: string
}

export interface OpcionesGuardado {
  clienteId: string | null
  nuevoCliente: { nombre: string; rfc: string; direccion: string } | null
  crearEquipos: boolean
  crearOrdenes: boolean
  usuarioId: string
  empresaId: string
}

export interface ResultadoGuardado {
  contratoId: string | null
  pasos: string[]
  error: string | null
}

// Tope de equipos generados por renglón cuando la ficha da solo una cantidad.
const MAX_UNIDADES_POR_RENGLON = 50

const hoy = () => new Date().toISOString().slice(0, 10)

export async function guardarImportacion(
  supabase: SupabaseClient,
  ex: ExtraccionContrato,
  archivos: ArchivoLote[],
  op: OpcionesGuardado,
  avance: (mensaje: string) => void,
): Promise<ResultadoGuardado> {
  const pasos: string[] = []
  const falla = (mensaje: string, contratoId: string | null = null): ResultadoGuardado => ({
    contratoId,
    pasos,
    error: mensaje,
  })

  // 1. Cliente / dependencia
  let clienteId = op.clienteId
  if (!clienteId) {
    if (!op.nuevoCliente?.nombre.trim()) return falla("Indica la dependencia (cliente).")
    avance("Registrando la dependencia…")
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre: op.nuevoCliente.nombre.trim(),
        rfc: op.nuevoCliente.rfc.trim().toUpperCase(),
        direccion: op.nuevoCliente.direccion.trim(),
        tipo: "Gobierno",
      })
      .select("id")
      .single()
    if (error || !data) return falla("No se pudo registrar la dependencia.")
    clienteId = data.id as string
    pasos.push(`Dependencia “${op.nuevoCliente.nombre.trim()}” registrada como cliente de gobierno.`)
  }

  // 2. Contrato
  avance("Registrando el contrato…")
  const c = ex.contrato
  const { data: contratoRow, error: errorContrato } = await supabase
    .from("contratos")
    .insert({
      ...contratoToDb({
        clienteId,
        numeroContrato: c.numero_contrato,
        objeto: c.objeto,
        areaRequirente: c.area_requirente,
        procedimiento: c.procedimiento,
        caracter: c.caracter,
        electronico: c.electronico,
        fechaFirma: c.fecha_firma || null,
        vigenciaInicio: c.vigencia_inicio || null,
        vigenciaFin: c.vigencia_fin || null,
        fechaLimiteEntrega: c.fecha_limite_entrega || null,
        subtotal: c.subtotal,
        iva: c.iva,
        total: c.total,
        moneda: c.moneda || "MXN",
        anticipoPct: c.anticipo_pct,
        garantiaCumplimientoPct: c.garantia_cumplimiento_pct,
        garantiaCalidadMeses: c.garantia_calidad_meses,
        penaDiariaPct: c.pena_diaria_pct,
        penaMaximaPct: c.pena_maxima_pct,
        plazoPagoDiasHabiles: c.plazo_pago_dias_habiles,
        administradorNombre: c.administrador_nombre,
        administradorCargo: c.administrador_cargo,
        lugarEjecucion: c.lugar_ejecucion,
        contactoTelefono: c.contacto_telefono,
        contactoEmail: c.contacto_email,
        suficienciaPresupuestal: c.suficiencia_presupuestal,
        estado: "Por iniciar",
        notas: "Registrado desde documentos (lectura automática).",
      }),
    })
    .select("id")
    .single()
  if (errorContrato || !contratoRow) {
    return falla(
      errorContrato?.code === "23505"
        ? "Ya existe un contrato con ese número en esta empresa."
        : "No se pudo registrar el contrato.",
    )
  }
  const contratoId = contratoRow.id as string
  pasos.push(`Contrato ${c.numero_contrato} registrado.`)

  // 3. Partidas
  avance("Registrando partidas…")
  const partidaIds = new Map<number, string>()
  if (ex.partidas.length) {
    const { data, error } = await supabase
      .from("contrato_partidas")
      .insert(
        ex.partidas.map((p) => ({
          ...partidaToDb({
            numero: p.numero,
            descripcion: p.descripcion || `Partida ${p.numero}`,
            unidad: p.unidad,
            cantidad: p.cantidad,
            precioUnitario: p.precio_unitario,
            cucop: p.cucop,
            alcance: p.alcance,
            lugarEjecucion: p.lugar_ejecucion,
            equipos: p.equipos,
            region: p.region,
            zona: p.zona,
            instalacion: p.instalacion,
            area: p.area,
          }),
          contrato_id: contratoId,
          ficha_tecnica: p.ficha_tecnica,
          nombre_proyecto: p.nombre_proyecto,
          actividades: p.actividades,
        })),
      )
      .select("id, numero")
    if (error || !data) return falla("Se registró el contrato, pero no sus partidas.", contratoId)
    for (const r of data) partidaIds.set(r.numero as number, r.id as string)
    pasos.push(`${data.length} partida(s) registradas.`)
  }

  // 4. Equipos (uno por unidad, para que cada uno lleve su historial)
  const equiposPorPartida = new Map<number, string[]>()
  if (op.crearEquipos) {
    avance("Registrando equipos…")
    const filas: Record<string, unknown>[] = []
    const partidaDeFila: number[] = []
    for (const p of ex.partidas) {
      for (const e of p.equipos) {
        const unidades = e.serie || e.inventario ? 1 : Math.min(e.cantidad, MAX_UNIDADES_POR_RENGLON)
        for (let u = 0; u < unidades; u++) {
          filas.push({
            cliente_id: clienteId,
            tipo: e.descripcion || "Equipo",
            marca: e.marca,
            modelo: e.modelo,
            numero_serie: e.serie,
            numero_inventario: e.inventario,
            ubicacion: p.lugar_ejecucion,
            region: p.region,
            zona: p.zona,
            instalacion: p.instalacion,
            area: p.area,
            estado: "Operativo",
            notas: `Contrato ${c.numero_contrato}, partida ${p.numero}.`,
          })
          partidaDeFila.push(p.numero)
        }
      }
    }
    if (filas.length) {
      const { data, error } = await supabase.from("equipos").insert(filas).select("id")
      if (error || !data) return falla("Se registraron contrato y partidas, pero no los equipos.", contratoId)
      data.forEach((r, i) => {
        const lista = equiposPorPartida.get(partidaDeFila[i]) ?? []
        lista.push(r.id as string)
        equiposPorPartida.set(partidaDeFila[i], lista)
      })
      pasos.push(`${data.length} equipo(s) registrados con su ubicación.`)
    }
  }

  // 5. Órdenes: una por partida (el servicio que especifica el contrato), con sus equipos
  if (op.crearOrdenes) {
    avance("Generando órdenes de servicio…")
    let creadas = 0
    for (const p of ex.partidas) {
      const partidaId = partidaIds.get(p.numero)
      if (!partidaId) continue
      const equipos = equiposPorPartida.get(p.numero) ?? []
      const { data: orden, error } = await supabase
        .from("ordenes_servicio")
        .insert({
          cliente_id: clienteId,
          equipo_id: equipos[0] ?? null,
          contrato_id: contratoId,
          contrato_partida_id: partidaId,
          referencia: referenciaOrden(c.numero_contrato, p.numero),
          fecha_solicitud: hoy(),
          tipo_servicio: "Preventivo",
          prioridad: "Normal",
          estado: "Pendiente de asignación",
          descripcion_falla: [`Partida ${p.numero}: ${p.descripcion}`, p.alcance].filter(Boolean).join("\n\n"),
          creado_por: op.usuarioId,
          historial: [],
        })
        .select("id")
        .single()
      if (error || !orden) return falla(`No se pudo generar la orden de la partida ${p.numero}.`, contratoId)
      if (equipos.length) {
        const { error: errorEq } = await supabase
          .from("orden_equipos")
          .insert(equipos.map((equipo_id) => ({ orden_id: orden.id, equipo_id })))
        if (errorEq) return falla(`La orden de la partida ${p.numero} se creó sin sus equipos.`, contratoId)
      }
      creadas++
    }
    if (creadas) pasos.push(`${creadas} orden(es) de servicio generadas (procedencia “Contrato”).`)
  }

  // 6. Expediente: copiar archivos de la carpeta temporal a la del contrato
  avance("Guardando documentos en el expediente…")
  const documentoPorIndice = new Map<number, string>()
  for (const a of archivos) {
    const destino = `${op.empresaId}/${contratoId}/${Date.now()}-${a.indice}-${nombreArchivoSeguro(a.nombre)}`
    const { error: errorCopia } = await supabase.storage.from(BUCKET_EXPEDIENTES).copy(a.ruta, destino)
    if (errorCopia) return falla(`No se pudo guardar “${a.nombre}” en el expediente.`, contratoId)
    const tipo = ex.documentos.find((d) => d.indice === a.indice)?.tipo ?? "Otro"
    const { data, error } = await supabase
      .from("contrato_documentos")
      .insert({
        contrato_id: contratoId,
        tipo,
        nombre_archivo: a.nombre,
        storage_path: destino,
        mime_type: a.tipo,
        tamano_bytes: a.tamano,
        notas: ex.documentos.find((d) => d.indice === a.indice)?.descripcion ?? "",
      })
      .select("id")
      .single()
    if (error || !data) return falla(`No se pudo registrar “${a.nombre}” en el expediente.`, contratoId)
    documentoPorIndice.set(a.indice, data.id as string)
  }
  if (archivos.length) pasos.push(`${archivos.length} documento(s) guardados en el expediente.`)

  // 7. Garantías (con la póliza ligada si se subió)
  if (ex.garantias.length) {
    avance("Registrando garantías…")
    const { error } = await supabase.from("contrato_garantias").insert(
      ex.garantias.map((g) => ({
        contrato_id: contratoId,
        tipo: g.tipo,
        forma: g.forma,
        requerida: g.requerida,
        porcentaje: g.porcentaje,
        monto: g.monto,
        divisible: g.divisible,
        beneficiaria: g.beneficiaria,
        afianzadora: g.afianzadora,
        numero_poliza: g.numero_poliza,
        folio: g.folio,
        linea_validacion: g.linea_validacion,
        fecha_expedicion: g.fecha_expedicion || null,
        fecha_limite_entrega: g.fecha_limite_entrega || null,
        vigencia_hasta: g.vigencia_hasta || null,
        estado: !g.requerida ? "Exceptuada" : g.numero_poliza ? "Emitida" : "Por tramitar",
        documento_poliza_id: g.archivo_poliza >= 0 ? (documentoPorIndice.get(g.archivo_poliza) ?? null) : null,
      })),
    )
    if (error) return falla("Todo se registró menos las garantías; agrégalas en el contrato.", contratoId)
    pasos.push(`${ex.garantias.length} garantía(s) registradas.`)
  }

  return { contratoId, pasos, error: null }
}

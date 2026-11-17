// Guarda las órdenes físicas revisadas, con la sesión del usuario (RLS):
// cierra cada orden como Terminada (técnico, fecha, actividades y equipos
// realizados, quién entregó y recibió) y guarda el escaneo en el expediente
// del contrato. Si la partida del contrato aún no tiene orden, la crea.

import type { SupabaseClient } from "@supabase/supabase-js"

import { BUCKET_EXPEDIENTES, nombreArchivoSeguro } from "@/lib/contratos"
import type { ArchivoLote } from "@/lib/importacion-guardar"
import type { OrdenLeida } from "@/lib/importacion-ordenes"

/** Datos de la partida cuando hay que crear la orden. */
export interface DestinoNuevaOrden {
  contratoId: string
  partidaId: string
  clienteId: string
  referencia: string
  descripcion: string
}

export interface OrdenRevisada {
  archivoIndice: number
  leida: OrdenLeida
  /** Orden existente que se cierra; null si se crea en `nueva`. */
  ordenId: string | null
  nueva: DestinoNuevaOrden | null
  tecnicoId: string | null
  tecnicoNombre: string
  fechaCierre: string
  /** equipo_id → realizado. En una orden nueva, los equipos que se le ligan. */
  equipos: Record<string, boolean>
  /** número de actividad → realizada. */
  actividades: Record<number, boolean>
  observaciones: string
}

export interface ResultadoOrdenes {
  pasos: string[]
  errores: string[]
}

/** Texto de entrega-recepción que se agrega a las observaciones de la orden. */
export function textoEntrega(o: OrdenLeida, fechaCierre: string): string {
  // Sin punto final: la frase ya lo agrega (evita "Mtz..").
  const n = (s: string) => s.trim().replace(/[.\s]+$/, "")
  const partes = [
    `Orden física firmada${fechaCierre ? ` el ${fechaCierre.split("-").reverse().join("/")}` : ""}.`,
    o.tecnicos.length ? `Entregó: ${o.tecnicos.map(n).join(", ")}.` : "",
    o.verifico ? `Verificó: ${n(o.verifico)}.` : "",
    o.recibio_area_tecnica ? `Recibió por el área técnica: ${n(o.recibio_area_tecnica)}.` : "",
    o.recibio_area_usuaria ? `Recibió por el área usuaria: ${n(o.recibio_area_usuaria)}.` : "",
    o.observaciones ? `Observaciones de la hoja: ${o.observaciones}` : "",
  ]
  return partes.filter(Boolean).join(" ")
}

export async function guardarOrdenesFisicas(
  supabase: SupabaseClient,
  revisadas: OrdenRevisada[],
  archivos: ArchivoLote[],
  usuario: { id: string; nombre: string; empresaId: string },
  avance: (mensaje: string) => void,
): Promise<ResultadoOrdenes> {
  const pasos: string[] = []
  const errores: string[] = []
  // archivo → contrato → folios cerrados (para registrar el escaneo una vez por contrato).
  const documentos = new Map<string, { archivo: ArchivoLote; contratoId: string; folios: string[] }>()

  for (const [n, r] of revisadas.entries()) {
    const etiqueta = r.leida.referencia || r.leida.folio || `orden ${n + 1}`
    avance(`Cerrando ${etiqueta} (${n + 1} de ${revisadas.length})…`)

    // 1. Orden: la existente o una nueva en la partida del contrato.
    let ordenId = r.ordenId
    if (!ordenId && r.nueva) {
      const equiposNuevos = Object.keys(r.equipos)
      const { data, error } = await supabase
        .from("ordenes_servicio")
        .insert({
          cliente_id: r.nueva.clienteId,
          equipo_id: equiposNuevos[0] ?? null,
          contrato_id: r.nueva.contratoId,
          contrato_partida_id: r.nueva.partidaId,
          referencia: r.nueva.referencia || r.leida.referencia || null,
          fecha_solicitud: r.fechaCierre || new Date().toISOString().slice(0, 10),
          tipo_servicio: "Preventivo",
          prioridad: "Normal",
          estado: "Pendiente de asignación",
          descripcion_falla: r.nueva.descripcion || r.leida.descripcion,
          creado_por: usuario.id,
          historial: [],
        })
        .select("id")
        .single()
      if (error || !data) {
        errores.push(`${etiqueta}: no se pudo crear la orden.`)
        continue
      }
      ordenId = data.id as string
      if (equiposNuevos.length) {
        const { error: errorEq } = await supabase
          .from("orden_equipos")
          .insert(equiposNuevos.map((equipo_id) => ({ orden_id: ordenId, equipo_id, realizado: r.equipos[equipo_id] })))
        if (errorEq) errores.push(`${etiqueta}: la orden se creó sin sus equipos.`)
      }
    }
    if (!ordenId) continue

    const { data: actual, error: errorLectura } = await supabase
      .from("ordenes_servicio")
      .select("folio, estado, contrato_id, actividades, historial, trabajo_realizado, observaciones, fecha_inicio")
      .eq("id", ordenId)
      .single()
    if (errorLectura || !actual) {
      errores.push(`${etiqueta}: no se encontró la orden.`)
      continue
    }

    // 2. Cierre de la orden.
    const actividades = (Array.isArray(actual.actividades) ? actual.actividades : []).map((a: any) => ({
      ...a,
      realizada: r.actividades[a.numero] ?? a.realizada ?? false,
    }))
    const historial = Array.isArray(actual.historial) ? actual.historial : []
    const yaTerminada = actual.estado === "Terminada"
    const trabajo =
      (actual.trabajo_realizado ?? "").trim() ||
      r.leida.actividades.map((a) => a.texto).filter(Boolean).join("\n") ||
      r.leida.descripcion
    // Si la orden ya trae la entrega-recepción de la hoja física, no se repite.
    const previas = String(actual.observaciones ?? "").trim()
    const nuevas = previas.includes("Orden física firmada") ? "" : r.observaciones.trim()
    const observaciones = [previas, nuevas].filter(Boolean).join("\n\n")

    const { error: errorCierre } = await supabase
      .from("ordenes_servicio")
      .update({
        estado: "Terminada",
        tecnico_id: r.tecnicoId,
        tecnico_responsable: r.tecnicoNombre || null,
        fecha_inicio: actual.fecha_inicio ?? (r.fechaCierre || null),
        fecha_cierre: r.fechaCierre || new Date().toISOString().slice(0, 10),
        trabajo_realizado: trabajo,
        observaciones,
        actividades,
        historial: yaTerminada
          ? historial
          : [
              ...historial,
              {
                estado: "Terminada",
                fecha: new Date().toISOString(),
                usuarioId: usuario.id,
                usuarioNombre: `${usuario.nombre} (orden física)`,
              },
            ],
      })
      .eq("id", ordenId)
    if (errorCierre) {
      errores.push(`${actual.folio}: no se pudo cerrar la orden.`)
      continue
    }

    // 3. Equipos realizados (en las órdenes existentes).
    if (r.ordenId) {
      for (const [equipoId, realizado] of Object.entries(r.equipos)) {
        const { error } = await supabase
          .from("orden_equipos")
          .update({ realizado })
          .eq("orden_id", ordenId)
          .eq("equipo_id", equipoId)
        if (error) errores.push(`${actual.folio}: no se pudo marcar un equipo.`)
      }
    }
    const hechos = Object.values(r.equipos).filter(Boolean).length
    pasos.push(
      `${actual.folio}${r.leida.referencia ? ` (${r.leida.referencia})` : ""}: ${r.nueva ? "creada y " : ""}terminada` +
        `${r.tecnicoNombre ? `, técnico ${r.tecnicoNombre}` : ""}` +
        `${Object.keys(r.equipos).length ? `, ${hechos} de ${Object.keys(r.equipos).length} equipo(s) realizados` : ""}.`,
    )

    // 4. El escaneo va al expediente del contrato.
    const archivo = archivos.find((a) => a.indice === r.archivoIndice)
    if (archivo && actual.contrato_id) {
      const k = `${archivo.indice}|${actual.contrato_id}`
      const doc = documentos.get(k) ?? { archivo, contratoId: actual.contrato_id as string, folios: [] }
      doc.folios.push(`${actual.folio}${r.leida.referencia ? ` (${r.leida.referencia})` : ""}`)
      documentos.set(k, doc)
    } else if (archivo) {
      errores.push(`${actual.folio}: no tiene contrato, el escaneo no se guardó en ningún expediente.`)
    }
  }

  // 5. Escaneos al expediente (una vez por archivo y contrato).
  if (documentos.size) avance("Guardando los escaneos en el expediente…")
  for (const { archivo, contratoId, folios } of documentos.values()) {
    const destino = `${usuario.empresaId}/${contratoId}/${Date.now()}-orden-${nombreArchivoSeguro(archivo.nombre)}`
    const { error: errorCopia } = await supabase.storage.from(BUCKET_EXPEDIENTES).copy(archivo.ruta, destino)
    if (errorCopia) {
      errores.push(`No se pudo guardar “${archivo.nombre}” en el expediente.`)
      continue
    }
    const { error } = await supabase.from("contrato_documentos").insert({
      contrato_id: contratoId,
      tipo: "Informe de servicio",
      nombre_archivo: archivo.nombre,
      storage_path: destino,
      mime_type: archivo.tipo,
      tamano_bytes: archivo.tamano,
      notas: `Orden de servicio firmada: ${folios.join(", ")}.`,
    })
    if (error) errores.push(`No se pudo registrar “${archivo.nombre}” en el expediente.`)
    else pasos.push(`Escaneo “${archivo.nombre}” guardado en el expediente del contrato.`)
  }

  return { pasos, errores }
}

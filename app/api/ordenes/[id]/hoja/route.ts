import { NextResponse } from "next/server"

import type { HojaOrden } from "@/lib/hoja-orden"
import { adminClient } from "@/lib/importacion-servidor"
import { accesoOrden } from "@/lib/orden-acceso"

const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v))

// Datos para imprimir la hoja de la orden con el formato de su empresa.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await accesoOrden((await params).id)
  if (!acceso.ok) return NextResponse.json({ error: acceso.error }, { status: acceso.status })

  const admin = adminClient()
  const { data: o } = await admin.from("ordenes_servicio").select("*").eq("id", acceso.ordenId).single()
  if (!o) return NextResponse.json({ error: "La orden no existe." }, { status: 404 })

  const [empresa, cliente, contrato, partida, equipos, tecnico, documento] = await Promise.all([
    admin.from("empresas").select("*").eq("id", o.empresa_id).single(),
    admin.from("clientes").select("nombre, direccion, notas").eq("id", o.cliente_id).maybeSingle(),
    o.contrato_id
      ? admin.from("contratos").select("numero_contrato, objeto, garantia_calidad_meses").eq("id", o.contrato_id).maybeSingle()
      : Promise.resolve({ data: null }),
    o.contrato_partida_id
      ? admin
          .from("contrato_partidas")
          .select("numero, descripcion, nombre_proyecto, ficha_tecnica")
          .eq("id", o.contrato_partida_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("orden_equipos")
      .select("realizado, equipos(tipo, marca, modelo, numero_serie, numero_inventario)")
      .eq("orden_id", o.id),
    o.tecnico_id ? admin.from("tecnicos").select("nombre").eq("id", o.tecnico_id).maybeSingle() : Promise.resolve({ data: null }),
    o.documento_firmado_id
      ? admin.from("contrato_documentos").select("nombre_archivo").eq("id", o.documento_firmado_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const e = empresa.data ?? {}
  const historial: any[] = Array.isArray(o.historial) ? o.historial : []
  const firmaTecnico = [...historial].reverse().find((h) => h?.tipo === "Firma técnico" && h?.firmaTecnico)
  const notasCliente = txt(cliente.data?.notas)
  const dependencia = /Dependencia:\s*([^.\n]+)/.exec(notasCliente)?.[1]?.trim() ?? ""

  // Equipos ligados a la orden; las órdenes de un solo equipo usan equipo_id.
  let listaEquipos = (equipos.data ?? []).map((r: any) => ({
    descripcion: txt(r.equipos?.tipo),
    marca: txt(r.equipos?.marca),
    modelo: txt(r.equipos?.modelo),
    serie: txt(r.equipos?.numero_serie),
    inventario: txt(r.equipos?.numero_inventario),
    realizado: !!r.realizado,
  }))
  if (listaEquipos.length === 0 && o.equipo_id) {
    const { data: eq } = await admin
      .from("equipos")
      .select("tipo, marca, modelo, numero_serie, numero_inventario")
      .eq("id", o.equipo_id)
      .maybeSingle()
    if (eq) {
      listaEquipos = [
        {
          descripcion: txt(eq.tipo),
          marca: txt(eq.marca),
          modelo: txt(eq.modelo),
          serie: txt(eq.numero_serie),
          inventario: txt(eq.numero_inventario),
          realizado: o.estado === "Terminada",
        },
      ]
    }
  }

  const hoja: HojaOrden = {
    empresa: {
      clave: txt(e.clave),
      nombreComercial: txt(e.nombre_comercial),
      razonSocial: txt(e.razon_social),
      rfc: txt(e.rfc),
      domicilio: txt(e.domicilio),
      telefono: txt(e.telefono),
      email: txt(e.email),
      representanteLegal: txt(e.representante_legal),
      representanteCargo: txt(e.representante_cargo),
      giro: txt(e.giro),
    },
    orden: {
      id: o.id,
      folio: txt(o.folio),
      referencia: txt(o.referencia),
      estado: txt(o.estado),
      fecha: o.fecha_cierre ?? o.fecha_programada ?? o.fecha_solicitud ?? null,
      descripcion: txt(o.descripcion_falla),
      trabajoRealizado: txt(o.trabajo_realizado),
      observaciones: txt(o.observaciones),
      region: txt(o.region),
      zona: txt(o.zona),
      instalacion: txt(o.instalacion),
      area: txt(o.area),
    },
    cliente: { nombre: txt(cliente.data?.nombre), direccion: txt(cliente.data?.direccion), dependencia },
    contrato: contrato.data
      ? {
          numero: txt(contrato.data.numero_contrato),
          objeto: txt(contrato.data.objeto),
          garantiaCalidadMeses:
            contrato.data.garantia_calidad_meses == null ? null : Number(contrato.data.garantia_calidad_meses),
        }
      : null,
    partida: partida.data
      ? {
          numero: Number(partida.data.numero) || 0,
          descripcion: txt(partida.data.descripcion),
          nombreProyecto: txt(partida.data.nombre_proyecto),
          fichaTecnica: txt(partida.data.ficha_tecnica),
        }
      : null,
    equipos: listaEquipos,
    actividades: (Array.isArray(o.actividades) ? o.actividades : []).map((a: any, j: number) => ({
      numero: Number(a?.numero) || j + 1,
      titulo: txt(a?.titulo),
      detalle: Array.isArray(a?.detalle) ? a.detalle.map(txt).filter(Boolean) : [],
      realizada: !!a?.realizada,
    })),
    tecnico: txt(tecnico.data?.nombre) || txt(o.tecnico_responsable),
    firmas: {
      tecnico: txt(firmaTecnico?.firmaTecnico),
      tecnicoFecha: firmaTecnico?.firmaTecnicoFecha ?? null,
      areaUsuaria: txt(o.firma_cliente),
      areaUsuariaNombre: txt(o.firma_cliente_nombre),
      areaUsuariaFecha: o.firma_fecha ?? null,
      areaTecnica: txt(o.firma_area_tecnica),
      areaTecnicaNombre: txt(o.firma_area_tecnica_nombre),
      areaTecnicaFecha: o.firma_area_tecnica_fecha ?? null,
    },
    evidencias: (Array.isArray(o.evidencias) ? o.evidencias : [])
      .filter((ev: any) => typeof ev?.url === "string" && /^https?:\/\//.test(ev.url))
      .map((ev: any) => ({ url: ev.url as string, descripcion: txt(ev.descripcion), fase: txt(ev.fase) })),
    documentoFirmado: documento.data ? { nombre: txt(documento.data.nombre_archivo) } : null,
  }
  return NextResponse.json({ hoja })
}

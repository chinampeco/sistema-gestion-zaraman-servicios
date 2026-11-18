"use client"

// Documentos que se generan al concluir el servicio de una orden de contrato
// (los que pide la ficha técnica en "Documentación"): Carta garantía y Plan de
// trabajo con anexo gráfico. Salen en la hoja membretada de cada empresa y se
// imprimen o guardan como PDF; los descargan el personal, el técnico y el cliente.

import * as React from "react"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HojaEquipo, HojaOrden } from "@/lib/hoja-orden"

export const DOCUMENTOS_CIERRE = [
  { clave: "carta-garantia", titulo: "Carta garantía" },
  { clave: "plan-trabajo", titulo: "Plan de trabajo" },
] as const
export type ClaveDocumentoCierre = (typeof DOCUMENTOS_CIERRE)[number]["clave"]

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const NUMEROS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro"]

/** "2026-11-03" → "03 de noviembre de 2026". */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!a || !m || !d) return ""
  return `${String(d).padStart(2, "0")} de ${MESES[m - 1]} de ${a}`
}

/** 6 → "6 (seis)". */
export function numeroConLetra(n: number): string {
  return NUMEROS[n] ? `${n} (${NUMEROS[n]})` : String(n)
}

/** "INGENIERÍA Y MANTENIMIENTO INDUSTRIAL TOLTECATL S.A. de C.V." → "Ingeniería y Mantenimiento Industrial Toltecatl S.A. de C.V." */
export function razonEnTitulo(razon: string): string {
  const menores = new Set(["y", "de", "del", "la", "las", "los", "e"])
  const [nombre, sufijo] = razon.split(/\s+(?=S\.?\s?A\.?)/i)
  const titulo = nombre
    .toLocaleLowerCase("es-MX")
    .split(/\s+/)
    .map((p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toLocaleUpperCase("es-MX") + p.slice(1)))
    .join(" ")
  return sufijo ? `${titulo} ${sufijo.replace(/s\.?\s?a\.?\s*de\s*c\.?\s?v\.?/i, "S.A. de C.V.")}` : titulo
}

/** De "…, Alcaldía Miguel Hidalgo, Ciudad de México, C.P. 11200" → "Miguel Hidalgo, Ciudad de México". */
export function lugarDeDireccion(direccion: string): { ciudad: string; ubicacion: string } {
  const partes = direccion.split(",").map((p) => p.trim()).filter((p) => p && !/^c\.?\s?p\.?/i.test(p))
  const iMun = partes.findIndex((p) => /^(alcald[ií]a|municipio|mpio\.?|delegaci[oó]n)\s+/i.test(p))
  if (iMun >= 0) {
    const municipio = partes[iMun].replace(/^(alcald[ií]a|municipio|mpio\.?|delegaci[oó]n)\s+/i, "")
    const ciudad = partes[iMun + 1] ?? municipio
    return { ciudad, ubicacion: [municipio, partes[iMun + 1]].filter(Boolean).join(", ") }
  }
  const ultimas = partes.slice(-2)
  return { ciudad: ultimas[ultimas.length - 1] ?? "", ubicacion: ultimas.join(", ") }
}

function TablaEquiposCarta({ equipos }: { equipos: HojaEquipo[] }) {
  const grupos = new Map<string, { d: string; marca: string; ids: string[] }>()
  for (const e of equipos) {
    const k = `${e.descripcion}|${e.marca}`
    const g = grupos.get(k) ?? { d: [e.descripcion, e.modelo].filter(Boolean).join(" "), marca: e.marca, ids: [] }
    g.ids.push(e.inventario || e.serie || "")
    grupos.set(k, g)
  }
  if (grupos.size === 0) return null
  return (
    <table className="dc-tabla">
      <thead>
        <tr><th>Descripción</th><th>Cant</th><th>Mca.</th><th>No. S.I.L.</th></tr>
      </thead>
      <tbody>
        {[...grupos.values()].map((g, i) =>
          g.ids.map((id, j) => (
            <tr key={`${i}-${j}`}>
              {j === 0 && (
                <>
                  <td rowSpan={g.ids.length}>{g.d}</td>
                  <td rowSpan={g.ids.length}>{g.ids.length}</td>
                  <td rowSpan={g.ids.length}>{g.marca}</td>
                </>
              )}
              <td>{id}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  )
}

interface Encabezado {
  lugar: string
  fecha: string
  dependencia: string
  areaUsuaria: string
  ubicacion: string
}

/** Página con la hoja membretada de la empresa. */
function Pagina({ hoja, children }: { hoja: HojaOrden; children: React.ReactNode }) {
  const clave = hoja.empresa.clave
  if (clave === "TOLTECATL") {
    return (
      <div className="dc-pagina dc-membrete-tol">
        <div className="dc-cuerpo">{children}</div>
      </div>
    )
  }
  return (
    <div className="dc-pagina">
      {clave === "BOCAM" ? (
        <div className="dc-head-boc">
          <div className="dc-boc-nom">CONSTRUCTORA E INMOBILIARIA BOCAM S.A. DE C.V.</div>
          <div className="dc-boc-dat">
            <div>EDIFICIO CAMPECHE No. 43 DEPTO. 302<br />FRACC. LAS TORRES C.P. 60950<br />Email: constructora_bocam@yahoo.com.mx</div>
            <div>LÁZARO CÁRDENAS, MICH.<br />R.F.C.: CIB-130321-IF7</div>
            <div>TEL. Y FAX:<br />7531142513<br />7535313100</div>
          </div>
        </div>
      ) : (
        <div className="dc-head-gen">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {clave === "ZARAMAN" ? <img src="/zaraman-logo.svg" alt={hoja.empresa.nombreComercial} /> : null}
          <div><b>{hoja.empresa.razonSocial}</b><br />RFC: {hoja.empresa.rfc} · {hoja.empresa.domicilio}<br />{[hoja.empresa.telefono, hoja.empresa.email].filter(Boolean).join(" · ")}</div>
        </div>
      )}
      <div className="dc-cuerpo dc-cuerpo-simple">{children}</div>
    </div>
  )
}

function EncabezadoCarta({ e, titulo }: { e: Encabezado; titulo: string }) {
  return (
    <>
      <p className="dc-fecha">{[e.lugar, e.fecha && `a ${e.fecha}`].filter(Boolean).join(", ")}</p>
      <p className="dc-dest">
        {e.dependencia && <>{e.dependencia.replace(/\.?$/, ".")}<br /></>}
        {e.areaUsuaria && <>{e.areaUsuaria}<br /></>}
        {e.ubicacion}
      </p>
      <p className="dc-titulo">“{titulo}”</p>
    </>
  )
}

function Firma({ hoja, alFinal = true }: { hoja: HojaOrden; alFinal?: boolean }) {
  return (
    <div className={alFinal ? "dc-firma" : "dc-firma dc-firma-arriba"}>
      Atentamente
      {hoja.empresa.firmaRepresentante ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={hoja.empresa.firmaRepresentante} alt={`Firma de ${hoja.empresa.representanteLegal}`} className="dc-firma-img" />
      ) : null}
      <div className={hoja.empresa.firmaRepresentante ? "dc-linea dc-linea-firmada" : "dc-linea"} />
      {hoja.empresa.representanteLegal}<br />
      {razonEnTitulo(hoja.empresa.razonSocial)}<br />
      {hoja.empresa.representanteCargo || "Representante Legal"}
    </div>
  )
}

function proyecto(h: HojaOrden) {
  return h.partida?.nombreProyecto || h.contrato?.objeto || ""
}

function CartaGarantia({ hoja: h, e }: { hoja: HojaOrden; e: Encabezado }) {
  const meses = h.contrato?.garantiaCalidadMeses ?? null
  const razon = razonEnTitulo(h.empresa.razonSocial)
  return (
    <Pagina hoja={h}>
      <EncabezadoCarta e={e} titulo="Carta garantía" />
      <p className="dc-texto">
        Yo el C. {h.empresa.representanteLegal}, {(h.empresa.representanteCargo || "representante legal").toLocaleLowerCase("es-MX")} de la empresa {razon}, por medio del
        presente escrito, manifiesto de decir verdad que los servicios de los trabajos para el procedimiento “{proyecto(h)}” con
        numero de contrato <b>{h.contrato?.numero}</b>, en relación a los servicios realizados tienen{" "}
        {meses ? `${numeroConLetra(meses)} meses` : "____ meses"} de garantía por defectos y/o vicios ocultos de los bienes y
        calidad de los servicios, exceptuando la garantía por mala práctica y/u operación por parte del personal; a partir de la
        fecha en la que fue entregado el servicio de mantenimiento conforme lo asentado en la orden de servicio de la partida{" "}
        <b>{h.partida?.numero ?? ""}</b>.
      </p>
      <p className="dc-texto">De antemano, gracias por la atención prestada al presente escrito.</p>
      <Firma hoja={h} alFinal={false} />
    </Pagina>
  )
}

const FOTOS_PRIMERA = 3
const FOTOS_POR_PAGINA = 12

function PlanTrabajo({ hoja: h, e }: { hoja: HojaOrden; e: Encabezado }) {
  const razon = razonEnTitulo(h.empresa.razonSocial)
  const fotos = h.evidencias
  const resto: (typeof fotos)[] = []
  for (let i = FOTOS_PRIMERA; i < fotos.length; i += FOTOS_POR_PAGINA) resto.push(fotos.slice(i, i + FOTOS_POR_PAGINA))
  const Foto = ({ f }: { f: (typeof fotos)[number] }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={f.url} alt={f.descripcion || "Evidencia del servicio"} />
  )
  return (
    <>
      <Pagina hoja={h}>
        <EncabezadoCarta e={e} titulo="Plan de trabajo" />
        <p className="dc-texto">
          Yo el C. {h.empresa.representanteLegal}, {(h.empresa.representanteCargo || "representante legal").toLocaleLowerCase("es-MX")} de la empresa {razon}, por
          medio del presente me permito remitir el plan de trabajo del contrato “{proyecto(h)}” con numero{" "}
          <b>{h.contrato?.numero}</b>, para el servicio de mantenimiento conforme se indica a continuación:
        </p>
        <p className="dc-texto dc-partida">
          <b>Partida {h.partida?.numero}:</b> {h.partida?.descripcion}{" "}
          {h.actividades.flatMap((a) => (a.detalle.length ? a.detalle : [a.titulo])).filter(Boolean).join(" ")}
        </p>
        <TablaEquiposCarta equipos={h.equipos} />
        <p className="dc-anexo">ANEXO GRÁFICO</p>
        {fotos.length === 0 ? (
          <p className="dc-sinfotos">Sin fotografías de evidencia registradas en la orden.</p>
        ) : (
          <div className="dc-fotos dc-fotos-3">{fotos.slice(0, FOTOS_PRIMERA).map((f, i) => <Foto key={i} f={f} />)}</div>
        )}
        {resto.length === 0 && <Firma hoja={h} />}
      </Pagina>
      {resto.map((grupo, i) => (
        <Pagina key={i} hoja={h}>
          <div className="dc-fotos">{grupo.map((f, j) => <Foto key={j} f={f} />)}</div>
          {i === resto.length - 1 && <Firma hoja={h} />}
        </Pagina>
      ))}
    </>
  )
}

const ESTILOS = `
.dc-pagina{position:relative;width:215.9mm;height:279.4mm;margin:0 auto 6mm;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;box-shadow:0 1px 4px rgba(0,0,0,.2);overflow:hidden}
.dc-membrete-tol{background:#fff url(/empresas/toltecatl-membrete.jpg) center/100% 100% no-repeat}
.dc-cuerpo{position:absolute;top:41mm;bottom:22mm;left:22mm;right:22mm;display:flex;flex-direction:column}
.dc-cuerpo-simple{top:34mm;bottom:14mm}
.dc-fecha{text-align:right;margin:0 0 9mm}
.dc-dest{font-weight:bold;line-height:1.35;margin:0 0 10mm}
.dc-titulo{text-align:center;font-weight:bold;margin:0 0 8mm}
.dc-texto{text-align:justify;line-height:2;margin:0 0 5mm;text-indent:2mm}
.dc-partida{line-height:1.45}.dc-partida b{color:#1d73b8}
.dc-tabla{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:11.5px}
.dc-tabla th,.dc-tabla td{border:1px solid #333;padding:1px 6px;text-align:center;vertical-align:middle}.dc-tabla th{background:#dbe8f6}
.dc-anexo{text-align:center;font-weight:bold;margin:2mm 0}
.dc-sinfotos{text-align:center;color:#666;font-style:italic}
.dc-fotos{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;align-content:start}
.dc-fotos img{width:100%;height:48mm;object-fit:cover;display:block}
.dc-fotos-3 img{height:52mm}
.dc-firma{margin-top:auto;text-align:center;line-height:1.35;padding-top:6mm}
.dc-firma-arriba{margin-top:14mm}
.dc-firma-img{display:block;height:24mm;margin:2mm auto -14mm;position:relative;z-index:1}
.dc-linea-firmada{border-bottom-color:transparent}
.dc-linea{width:62mm;border-bottom:1px solid #333;margin:16mm auto 2mm}
.dc-head-boc{text-align:center;padding:10mm 14mm 0}.dc-boc-nom{color:#00a650;font-family:Verdana,Arial,sans-serif;font-size:21px;font-weight:900}
.dc-boc-dat{display:grid;grid-template-columns:1.25fr 1fr .65fr;gap:4mm;width:150mm;margin:1mm auto 0;text-align:left;font-size:8.6px;font-weight:bold}
.dc-head-gen{display:flex;gap:6mm;align-items:center;margin:10mm 16mm 0;padding-bottom:3mm;border-bottom:3px solid #1e40af;font-size:10px}.dc-head-gen img{height:18mm}
@media print{
  @page{size:letter;margin:0}
  body *{visibility:hidden!important}
  .dc-print,.dc-print *{visibility:visible!important}
  .dc-print{position:absolute;left:0;top:0}
  .dc-pagina{margin:0;box-shadow:none;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .dc-noprint{display:none!important}
}`

/** El documento (una o varias páginas) listo para imprimir. */
export function DocumentoCierre({ tipo, hoja, encabezado }: { tipo: ClaveDocumentoCierre; hoja: HojaOrden; encabezado: Encabezado }) {
  return tipo === "carta-garantia" ? <CartaGarantia hoja={hoja} e={encabezado} /> : <PlanTrabajo hoja={hoja} e={encabezado} />
}

export const ESTILOS_DOCUMENTOS = ESTILOS

export function encabezadoInicial(h: HojaOrden): Encabezado {
  const { ciudad, ubicacion } = lugarDeDireccion(h.cliente.direccion)
  return {
    lugar: ciudad,
    fecha: h.orden.fecha ? fechaLarga(h.orden.fecha) : "",
    dependencia: h.cliente.dependencia,
    areaUsuaria: h.orden.instalacion || h.cliente.nombre,
    ubicacion,
  }
}

export function DocumentoCierreVista({
  ordenId,
  tipo,
  alVolver,
}: {
  ordenId: string
  tipo: ClaveDocumentoCierre
  alVolver?: React.ReactNode
}) {
  const [hoja, setHoja] = React.useState<HojaOrden | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [e, setE] = React.useState<Encabezado | null>(null)

  React.useEffect(() => {
    let vivo = true
    fetch(`/api/ordenes/${ordenId}/hoja`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) return setError(d.error ?? "No se pudo cargar la orden.")
        setHoja(d.hoja)
        setE(encabezadoInicial(d.hoja))
      })
      .catch(() => vivo && setError("No se pudo cargar la orden."))
    return () => {
      vivo = false
    }
  }, [ordenId])

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!hoja || !e) return <p className="text-sm text-muted-foreground">Cargando el documento…</p>
  if (!hoja.contrato) {
    return <p className="text-sm text-muted-foreground">Este documento solo aplica a órdenes de contrato.</p>
  }
  const titulo = DOCUMENTOS_CIERRE.find((d) => d.clave === tipo)?.titulo ?? ""
  const campo = (k: keyof Encabezado, etiqueta: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {etiqueta}
      <Input value={e[k]} onChange={(ev) => setE({ ...e, [k]: ev.target.value })} />
    </label>
  )

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS}</style>
      <div className="dc-noprint flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {alVolver}
          <Button onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Imprimir / Guardar PDF
          </Button>
          <span className="text-sm font-medium">{titulo} · {hoja.orden.referencia || hoja.orden.folio}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-5">
          {campo("lugar", "Lugar")}
          {campo("fecha", "Fecha")}
          {campo("dependencia", "Dependencia")}
          {campo("areaUsuaria", "Área usuaria")}
          {campo("ubicacion", "Ubicación")}
        </div>
        <p className="text-xs text-muted-foreground">
          Revisa los datos antes de imprimir; los cambios solo aplican a esta impresión. En el diálogo elige “Guardar como PDF” para descargarlo.
        </p>
      </div>
      <div className="dc-print overflow-x-auto">
        <DocumentoCierre tipo={tipo} hoja={hoja} encabezado={e} />
      </div>
    </div>
  )
}

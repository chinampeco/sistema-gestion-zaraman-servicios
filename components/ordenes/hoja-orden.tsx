"use client"

// Hoja de orden de servicio imprimible con el formato de cada empresa
// (TOLTECATL, BOCAM; ZARAMAN y las demás usan un formato general). Se llena
// con lo que el técnico registró en campo y las firmas capturadas al cerrar.

import * as React from "react"
import Link from "next/link"
import { Download, FileText, Printer } from "lucide-react"
import { toast } from "sonner"

import { DOCUMENTOS_CIERRE } from "@/components/ordenes/documentos-cierre"
import { Button } from "@/components/ui/button"
import { fechaCorta, type HojaEquipo, type HojaOrden } from "@/lib/hoja-orden"

interface GrupoEquipos {
  descripcion: string
  marca: string
  modelo: string
  ids: string[]
  cantidad: number
}

/** Agrupa equipos iguales (descripción + marca + modelo) para la tabla de la hoja. */
function agrupar(equipos: HojaEquipo[]): GrupoEquipos[] {
  const grupos = new Map<string, GrupoEquipos>()
  for (const e of equipos) {
    const k = `${e.descripcion}|${e.marca}|${e.modelo}`
    const g = grupos.get(k) ?? { descripcion: e.descripcion, marca: e.marca, modelo: e.modelo, ids: [], cantidad: 0 }
    g.cantidad += 1
    const id = e.inventario || e.serie
    if (id) g.ids.push(id)
    grupos.set(k, g)
  }
  return [...grupos.values()]
}

function Firma({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className="ho-firma" /> : <div className="ho-firma" />
}

function Check({ si }: { si: boolean }) {
  return <span className="ho-check">{si ? "✓" : ""}</span>
}

/** Tabla de equipos con el número S.I.L. / inventario de cada uno. */
function TablaEquipos({ hoja, etiquetaId }: { hoja: HojaOrden; etiquetaId: string }) {
  const grupos = agrupar(hoja.equipos)
  if (grupos.length === 0) return null
  return (
    <table className="ho-sil">
      <thead>
        <tr><th>Descripción</th><th>Cant</th><th>Mca.</th><th>{etiquetaId}</th></tr>
      </thead>
      <tbody>
        {grupos.map((g, i) =>
          (g.ids.length ? g.ids : [""]).map((id, j) => (
            <tr key={`${i}-${j}`}>
              {j === 0 && (
                <>
                  <td rowSpan={Math.max(1, g.ids.length)}>{[g.descripcion, g.modelo].filter(Boolean).join(" ")}</td>
                  <td rowSpan={Math.max(1, g.ids.length)} className="ho-c">{g.cantidad}</td>
                  <td rowSpan={Math.max(1, g.ids.length)} className="ho-c">{g.marca}</td>
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

function Actividad({ a }: { a: HojaOrden["actividades"][number] }) {
  return (
    <>
      {a.titulo && <b>{a.titulo}</b>}
      {a.detalle.length > 0 && (
        <ul className="ho-det">
          {a.detalle.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </>
  )
}

function ubicacionTexto(h: HojaOrden): string {
  const partes = [h.orden.instalacion || h.cliente.nombre, h.cliente.direccion].filter(Boolean)
  const extra = [h.orden.area && `Área: ${h.orden.area}`, h.orden.zona && `Zona: ${h.orden.zona}`, h.orden.region && `Región: ${h.orden.region}`]
    .filter(Boolean)
    .join(" · ")
  return [partes.join(", "), extra].filter(Boolean).join(" · ")
}

const marcaPrincipal = (h: HojaOrden) => [...new Set(h.equipos.map((e) => e.marca).filter(Boolean))].join(", ")

// ---------------------------------------------------------------------------

function FormatoToltecatl({ hoja: h }: { hoja: HojaOrden }) {
  const acts = h.actividades.length ? h.actividades : [{ numero: 1, titulo: h.orden.trabajoRealizado || h.orden.descripcion, detalle: [], realizada: h.orden.estado === "Terminada" }]
  return (
    <div className="ho-hoja ho-tol">
      {/* Encabezado original de su hoja membretada. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/empresas/toltecatl-encabezado-original.jpg" alt={h.empresa.razonSocial} className="ho-tol-img" />
      <table className="ho-folio">
        <tbody>
          <tr><td>Orden de servicio:</td><td>{h.orden.referencia || h.orden.folio}</td></tr>
          <tr><td>Fecha:</td><td>{fechaCorta(h.orden.fecha)}</td></tr>
        </tbody>
      </table>
      <div className="ho-tit">
        <b>Orden de servicio{h.partida ? ` de la partida No. ${h.partida.numero}` : ""}</b>
        {h.partida?.descripcion && <div>{h.partida.descripcion}</div>}
        {(h.partida?.nombreProyecto || h.contrato?.objeto) && <div>Proyecto: {h.partida?.nombreProyecto || h.contrato?.objeto}</div>}
      </div>
      <table className="ho-t">
        <tbody>
          <tr><td colSpan={4} className="ho-bar">Datos generales</td></tr>
          <tr>
            <td colSpan={2}>Descripción: {[...new Set(h.equipos.map((e) => e.descripcion).filter(Boolean))].join(" / ") || h.orden.descripcion.split("\n")[0]}</td>
            <td colSpan={2}>Dependencia: {h.cliente.dependencia || h.cliente.nombre}</td>
          </tr>
          <tr>
            <td colSpan={2}>Contrato:<br /><b>{h.contrato?.numero ?? "—"}</b></td>
            <td colSpan={2}>Ubicación: {ubicacionTexto(h)}</td>
          </tr>
          <tr>
            <td>Marca: <b>{marcaPrincipal(h)}</b></td>
            <td>Cantidad: <b>{h.equipos.length || ""}</b></td>
            <td colSpan={2}>{h.equipos.some((e) => e.inventario) ? "S.I.L.: " + h.equipos.map((e) => e.inventario).filter(Boolean).join(" - ") : ""}</td>
          </tr>
          <tr><td className="ho-bar ho-n">No</td><td colSpan={2} className="ho-bar">Equipos y/o Actividades</td><td className="ho-bar ho-r">Realizado</td></tr>
          {acts.map((a, i) => (
            <tr key={a.numero}>
              <td className="ho-c">{a.numero}</td>
              <td colSpan={2}>
                {i === 0 && <TablaEquipos hoja={h} etiquetaId="No. S.I.L." />}
                <Actividad a={a} />
              </td>
              <td className="ho-c"><Check si={a.realizada} /></td>
            </tr>
          ))}
          <tr><td colSpan={4} className="ho-bar">Observaciones</td></tr>
          <tr><td colSpan={4} className="ho-obs">{h.orden.observaciones}</td></tr>
          <tr><td colSpan={4} className="ho-bar">Entrega – Recepción del servicio</td></tr>
        </tbody>
      </table>
      <table className="ho-t ho-firmas">
        <tbody>
          <tr>
            <td><span>Entregó el trabajo por parte de Toltecatl:</span><Firma src={h.firmas.tecnico} alt="Firma del técnico" /><b>{h.tecnico}</b><small>(Nombre completo y firma)</small></td>
            <td><span>Verificó la entrega del trabajo por parte de Toltecatl:</span><div className="ho-firma" /><b>{h.empresa.representanteLegal}</b><small>{h.empresa.representanteCargo || "Representante Legal"}</small></td>
          </tr>
          <tr>
            <td><span>Recibió por parte del área Técnica:</span><Firma src={h.firmas.areaTecnica} alt="Firma del área técnica" /><b>{h.firmas.areaTecnicaNombre}</b><small>(Nombre completo y firma)</small></td>
            <td><span>Recibió por parte del área Usuaria:</span><Firma src={h.firmas.areaUsuaria} alt="Firma del área usuaria" /><b>{h.firmas.areaUsuariaNombre}</b><small>(Nombre completo y firma)</small></td>
          </tr>
        </tbody>
      </table>
      <div className="ho-sis"><span>Folio del sistema: {h.orden.folio}</span></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/empresas/toltecatl-pie.jpg" alt={`${h.empresa.razonSocial} – RFC ${h.empresa.rfc}`} className="ho-tol-img ho-tol-pie-img" />
    </div>
  )
}

function FormatoBocam({ hoja: h }: { hoja: HojaOrden }) {
  const grupos = agrupar(h.equipos)
  return (
    <div className="ho-hoja ho-boc">
      {/* Encabezado en texto (como su hoja de Word): nítido al imprimir. */}
      <div className="ho-boc-head">
        <div className="ho-boc-nom">CONSTRUCTORA E INMOBILIARIA BOCAM S.A. DE C.V.</div>
        <div className="ho-boc-dat">
          <div>EDIFICIO CAMPECHE No. 43 DEPTO. 302<br />FRACC. LAS TORRES C.P. 60950<br />Email: <u>constructora_bocam@yahoo.com.mx</u></div>
          <div>LÁZARO CÁRDENAS, MICH.<br />R.F.C.: CIB-130321-IF7</div>
          <div>TEL. Y FAX:<br />7531142513<br />7535313100</div>
        </div>
      </div>
      <table className="ho-boc-no"><tbody><tr><td>NO:</td><td>{h.orden.referencia || h.orden.folio}</td></tr></tbody></table>
      {h.partida && (
        <div className="ho-c">
          {h.partida.fichaTecnica ? <>VISITA DE CAMPO CONFORME A LA FICHA TÉCNICA <b>{h.partida.fichaTecnica}</b></> : <>ORDEN DE SERVICIO DE LA PARTIDA <b>{h.partida.numero}</b></>}
        </div>
      )}
      {(h.partida?.nombreProyecto || h.contrato?.objeto) && (
        <table className="ho-sinborde"><tbody><tr><td style={{ width: "24%" }}>Nombre del Proyecto:</td><td>“{h.partida?.nombreProyecto || h.contrato?.objeto}”</td></tr></tbody></table>
      )}
      <table className="ho-t">
        <tbody>
          <tr><td colSpan={3} className="ho-bv">INFORMACIÓN GENERAL</td></tr>
          <tr><td colSpan={2}><b>Ubicación:</b> {ubicacionTexto(h)}</td><td><b>Organismo:</b> {h.orden.instalacion || h.cliente.nombre}</td></tr>
          <tr><td colSpan={2}><b>DESCRIPCIÓN:</b> {h.partida?.descripcion || h.orden.descripcion.split("\n")[0]}</td><td><b>Fecha:</b> {fechaCorta(h.orden.fecha)}</td></tr>
          <tr><td className="ho-bv ho-n">No.</td><td className="ho-bv">ACTIVIDADES</td><td className="ho-bv ho-r">OPERATIVO</td></tr>
          {grupos.length > 0 && (
            <tr>
              <td className="ho-c">1</td>
              <td>
                <table className="ho-sil">
                  <thead><tr><th style={{ width: "12%" }}>Cant.</th><th>Equipo</th></tr></thead>
                  <tbody>
                    {grupos.map((g, i) => (
                      <tr key={i}>
                        <td className="ho-c">{g.cantidad}</td>
                        <td>{[g.descripcion, g.marca && `Mca. ${g.marca}`, g.modelo && `mod. ${g.modelo}`].filter(Boolean).join(", ")}{g.ids.length ? ` (${g.ids.join(", ")})` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
              <td className="ho-c"><Check si={h.equipos.length > 0 && h.equipos.every((e) => e.realizado)} /></td>
            </tr>
          )}
          {h.actividades.map((a, i) => (
            <tr key={a.numero}>
              <td className="ho-c">{grupos.length > 0 ? i + 2 : i + 1}</td>
              <td><Actividad a={a} /></td>
              <td className="ho-c"><Check si={a.realizada} /></td>
            </tr>
          ))}
          <tr><td colSpan={3} className="ho-bv">NOTAS ADICIONALES</td></tr>
          <tr><td colSpan={3} className="ho-obs">{h.orden.observaciones}</td></tr>
          <tr><td colSpan={3} className="ho-bv">FIRMA Y SELLO DEL ÁREA USUARIA</td></tr>
        </tbody>
      </table>
      <table className="ho-t ho-firmas">
        <tbody>
          <tr>
            <td><Firma src={h.firmas.areaUsuaria} alt="Firma del área usuaria" /><b>{h.firmas.areaUsuariaNombre}</b><small>(Nombre completo y firma)</small></td>
            <td><Firma src={h.firmas.areaTecnica} alt="Firma del área técnica" /><b>{h.firmas.areaTecnicaNombre}</b><small>(Sello de la Unidad / área técnica)</small></td>
          </tr>
          <tr><td colSpan={2} className="ho-bv">FIRMA DEL PERSONAL PERTENECIENTE A LA EMPRESA</td></tr>
          <tr>
            <td><span><b>REALIZÓ LA VISITA</b></span><Firma src={h.firmas.tecnico} alt="Firma del técnico" /><b>{h.tecnico}</b><small>(Nombre completo y firma)</small></td>
            <td><span><b>VISTO BUENO:</b></span><div className="ho-firma" /><b>{h.empresa.razonSocial}</b><small>{h.empresa.representanteLegal} · {h.empresa.representanteCargo || "Representante Legal"}</small></td>
          </tr>
        </tbody>
      </table>
      <div className="ho-sis"><span>Folio del sistema: {h.orden.folio}</span></div>
    </div>
  )
}

function FormatoGeneral({ hoja: h }: { hoja: HojaOrden }) {
  const acts = h.actividades.length ? h.actividades : [{ numero: 1, titulo: h.orden.trabajoRealizado || h.orden.descripcion, detalle: [], realizada: h.orden.estado === "Terminada" }]
  const logo = h.empresa.clave === "ZARAMAN" ? "/zaraman-logo.svg" : ""
  return (
    <div className="ho-hoja ho-gen">
      <div className="ho-gen-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {logo ? <img src={logo} alt={h.empresa.nombreComercial} /> : <b className="ho-gen-nom">{h.empresa.nombreComercial}</b>}
        <div>
          <b>{h.empresa.razonSocial}</b><br />
          RFC: {h.empresa.rfc}<br />
          {h.empresa.domicilio}<br />
          {[h.empresa.telefono, h.empresa.email].filter(Boolean).join(" · ")}
        </div>
      </div>
      <table className="ho-folio">
        <tbody>
          <tr><td>Orden de servicio:</td><td>{h.orden.referencia || h.orden.folio}</td></tr>
          <tr><td>Fecha:</td><td>{fechaCorta(h.orden.fecha)}</td></tr>
        </tbody>
      </table>
      <table className="ho-t">
        <tbody>
          <tr><td colSpan={4} className="ho-bar">Datos generales</td></tr>
          <tr><td colSpan={2}>Cliente: <b>{h.cliente.nombre}</b>{h.cliente.dependencia ? ` (${h.cliente.dependencia})` : ""}</td><td colSpan={2}>Contrato: <b>{h.contrato?.numero ?? "—"}</b>{h.partida ? ` · Partida ${h.partida.numero}` : ""}</td></tr>
          <tr><td colSpan={4}>Ubicación: {ubicacionTexto(h)}</td></tr>
          <tr><td className="ho-bar ho-n">No</td><td colSpan={2} className="ho-bar">Equipos y/o Actividades</td><td className="ho-bar ho-r">Realizado</td></tr>
          {acts.map((a, i) => (
            <tr key={a.numero}>
              <td className="ho-c">{a.numero}</td>
              <td colSpan={2}>{i === 0 && <TablaEquipos hoja={h} etiquetaId="Serie / Inventario" />}<Actividad a={a} /></td>
              <td className="ho-c"><Check si={a.realizada} /></td>
            </tr>
          ))}
          <tr><td colSpan={4} className="ho-bar">Observaciones</td></tr>
          <tr><td colSpan={4} className="ho-obs">{h.orden.observaciones}</td></tr>
        </tbody>
      </table>
      <table className="ho-t ho-firmas">
        <tbody>
          <tr>
            <td><span>Realizó el servicio:</span><Firma src={h.firmas.tecnico} alt="Firma del técnico" /><b>{h.tecnico}</b><small>Técnico</small></td>
            <td><span>Recibió de conformidad (área usuaria):</span><Firma src={h.firmas.areaUsuaria} alt="Firma del área usuaria" /><b>{h.firmas.areaUsuariaNombre}</b><small>(Nombre completo y firma)</small></td>
          </tr>
          {(h.firmas.areaTecnica || h.firmas.areaTecnicaNombre) && (
            <tr>
              <td colSpan={2}><span>Recibió por parte del área técnica:</span><Firma src={h.firmas.areaTecnica} alt="Firma del área técnica" /><b>{h.firmas.areaTecnicaNombre}</b></td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="ho-sis"><span>Folio del sistema: {h.orden.folio}</span></div>
    </div>
  )
}

export const ESTILOS_HOJA = `
.ho-hoja{width:196mm;margin:0 auto;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:10.5px;line-height:1.3;padding:6mm;box-shadow:0 1px 4px rgba(0,0,0,.15)}
.ho-hoja table{width:100%;border-collapse:collapse}
.ho-t td,.ho-t th{border:1px solid #333;padding:3px 5px;vertical-align:top}
.ho-c{text-align:center;vertical-align:middle!important}.ho-n{width:7%}.ho-r{width:15%}
.ho-bar{background:#1e40af;color:#fff;text-align:center;font-weight:bold}
.ho-bv{background:#00cc8f;text-align:center;font-weight:bold}
.ho-folio{margin:3mm 0 3mm auto;width:95mm!important}.ho-folio td{border:1px solid #333;padding:3px 6px;font-weight:bold;font-size:11px}.ho-folio td:first-child{background:#1e40af;color:#fff;text-align:right;width:45%}
.ho-tit{text-align:center;margin-bottom:3mm}.ho-tit b{font-size:13px}
.ho-sil{width:94%!important;margin:2px auto 6px}.ho-sil td,.ho-sil th{border:1px solid #555;padding:1px 4px;font-size:9.5px;vertical-align:middle}
.ho-det{margin:2px 0 0 14px;padding:0}
.ho-check{font-size:22px;color:#1e40af}
.ho-obs{height:12mm;white-space:pre-line}
.ho-firmas td{width:50%;text-align:center;vertical-align:bottom;height:28mm}
.ho-firmas td.ho-bv{height:auto;vertical-align:middle}
.ho-firmas span,.ho-firmas b,.ho-firmas small{display:block}.ho-firmas span{text-align:center;margin-bottom:2px}
.ho-firma{display:block;height:15mm;max-width:100%;margin:0 auto;object-fit:contain}
.ho-sis{font-size:8.5px;color:#555;margin-top:2mm}
.ho-tol-img{display:block;width:100%;height:auto}.ho-tol-pie-img{margin-top:3mm}
.ho-boc-head{text-align:center;margin-bottom:1mm}
.ho-boc-nom{color:#00a650;font-family:Verdana,"DejaVu Sans",Arial,sans-serif;font-size:21px;font-weight:900;letter-spacing:.3px;line-height:1.15}
.ho-boc-dat{display:grid;grid-template-columns:1.25fr 1fr .65fr;gap:4mm;width:150mm;margin:1mm auto 0;text-align:left;font-size:8.6px;font-weight:bold;line-height:1.3}
.ho-boc-dat u{color:#1d4ed8}.ho-boc-no{margin:2mm 0 3mm auto;width:105mm!important;background:#00cc8f}.ho-boc-no td{font-weight:bold;font-size:11px;padding:2px 6px;text-align:right}
.ho-sinborde td{padding:2px 4px}
.ho-gen-head{display:flex;gap:6mm;align-items:center;border-bottom:3px solid #1e40af;padding-bottom:3mm}.ho-gen-head img{height:20mm}.ho-gen-nom{font-size:20px}
@media print{
  @page{size:letter;margin:8mm}
  body *{visibility:hidden!important}
  .ho-print,.ho-print *{visibility:visible!important}
  .ho-print{position:absolute;left:0;top:0;width:100%}
  .ho-hoja{box-shadow:none;padding:0}
  .ho-noprint{display:none!important}
  .ho-bar,.ho-bv,.ho-folio td:first-child,.ho-boc-no{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`

/** La hoja con el formato de la empresa de la orden. */
export function HojaOrdenDocumento({ hoja }: { hoja: HojaOrden }) {
  const clave = hoja.empresa.clave
  if (clave === "TOLTECATL") return <FormatoToltecatl hoja={hoja} />
  if (clave === "BOCAM") return <FormatoBocam hoja={hoja} />
  return <FormatoGeneral hoja={hoja} />
}

export function HojaOrdenVista({
  ordenId,
  alVolver,
  rutaDocumentos,
}: {
  ordenId: string
  alVolver?: React.ReactNode
  /** Base de las rutas de los documentos de cierre (personal o portal). */
  rutaDocumentos?: string
}) {
  const [hoja, setHoja] = React.useState<HojaOrden | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [descargando, setDescargando] = React.useState(false)

  React.useEffect(() => {
    let vivo = true
    fetch(`/api/ordenes/${ordenId}/hoja`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) setError(d.error ?? "No se pudo cargar la orden.")
        else setHoja(d.hoja)
      })
      .catch(() => vivo && setError("No se pudo cargar la orden."))
    return () => {
      vivo = false
    }
  }, [ordenId])

  async function descargarFirmada() {
    setDescargando(true)
    const r = await fetch(`/api/ordenes/${ordenId}/documento`)
    const d = await r.json().catch(() => ({}))
    setDescargando(false)
    if (!r.ok) return toast.error(d.error ?? "No se pudo descargar.")
    window.location.assign(d.url)
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!hoja) return <p className="text-sm text-muted-foreground">Cargando la hoja de servicio…</p>

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS_HOJA}</style>
      <div className="ho-noprint flex flex-wrap items-center gap-2">
        {alVolver}
        <Button onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          Imprimir / Guardar PDF
        </Button>
        {hoja.documentoFirmado && (
          <Button variant="outline" onClick={descargarFirmada} disabled={descargando}>
            <Download data-icon="inline-start" />
            Descargar orden firmada (escaneo)
          </Button>
        )}
        {rutaDocumentos && hoja.contrato && hoja.orden.estado === "Terminada"
          ? DOCUMENTOS_CIERRE.map((d) => (
              <Button key={d.clave} variant="outline" render={<Link href={`${rutaDocumentos}/${d.clave}`} />} nativeButton={false}>
                <FileText data-icon="inline-start" />
                {d.titulo}
              </Button>
            ))
          : null}
        <span className="text-xs text-muted-foreground">
          En el diálogo de impresión elige “Guardar como PDF” para descargarla.
        </span>
      </div>
      <div className="ho-print overflow-x-auto">
        <HojaOrdenDocumento hoja={hoja} />
      </div>
    </div>
  )
}

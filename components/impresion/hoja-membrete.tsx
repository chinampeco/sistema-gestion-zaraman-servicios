"use client"

// Hoja tamaño carta para imprimir documentos de la empresa (currículum, CV de
// técnicos, relación de personal): membrete de TOLTECATL, encabezado de BOCAM
// o encabezado genérico, y firma del representante legal.

import * as React from "react"

export interface EmpresaImpresion {
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
  firma: string
}

/** Datos de la empresa activa para imprimir, incluida la firma del representante. */
export function useEmpresaImpresion(empresaId: string | undefined) {
  const [empresa, setEmpresa] = React.useState<EmpresaImpresion | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!empresaId) return
    fetch("/api/empresa-curriculum/impresion")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? "No se pudieron cargar los datos de la empresa.")
        setEmpresa(d.empresa)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los datos de la empresa."))
  }, [empresaId])
  return { empresa, error }
}

/** Bloque de firma del representante legal (con su firma impresa si existe). */
export function FirmaRepresentante({ empresa, leyenda = "A T E N T A M E N T E" }: { empresa: EmpresaImpresion; leyenda?: string }) {
  return (
    <div className="cv-firma-bloque">
      {leyenda && <p className="cv-firma-leyenda">{leyenda}</p>}
      {empresa.firma && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={empresa.firma} alt="" className="cv-firma-img" />
      )}
      <div className="cv-linea" />
      <b>{empresa.representanteLegal || "Representante legal"}</b>
      <br />
      {empresa.representanteCargo || "Representante legal"}
      <br />
      {empresa.razonSocial || empresa.nombreComercial}
    </div>
  )
}

export function Hoja({ empresa, children }: { empresa: EmpresaImpresion; children: React.ReactNode }) {
  const tol = empresa.clave === "TOLTECATL"
  return (
    <div className={`cv-pagina ${tol ? "cv-membrete-tol" : ""}`}>
      {!tol && (
        <div className={empresa.clave === "BOCAM" ? "cv-head-boc" : "cv-head-gen"}>
          <div className="cv-head-nom">{empresa.razonSocial || empresa.nombreComercial}</div>
          <div className="cv-head-dat">
            {[empresa.rfc && `RFC ${empresa.rfc}`, empresa.domicilio, empresa.telefono, empresa.email].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
      <div className={`cv-cuerpo ${tol ? "" : "cv-cuerpo-simple"}`}>{children}</div>
    </div>
  )
}

export const ESTILOS_HOJA = `
.cv-pagina{position:relative;width:215.9mm;height:279.4mm;margin:0 auto 6mm;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,.2);overflow:hidden}
.cv-membrete-tol{background:#fff url(/empresas/toltecatl-membrete.jpg) center/100% 100% no-repeat}
.cv-cuerpo{position:absolute;top:41mm;bottom:22mm;left:22mm;right:22mm;display:flex;flex-direction:column}
.cv-cuerpo-simple{top:30mm;bottom:14mm}
.cv-head-boc,.cv-head-gen{position:absolute;top:9mm;left:16mm;right:16mm;text-align:center;padding-bottom:2mm;border-bottom:3px solid #1e40af}
.cv-head-boc{border-bottom-color:#00a650}.cv-head-boc .cv-head-nom{color:#00a650}
.cv-head-nom{font-size:17px;font-weight:900;letter-spacing:.3px}
.cv-head-dat{font-size:9px;font-weight:bold;margin-top:1mm}
.cv-titulo{text-align:center;font-size:17px;font-weight:bold;margin:0 0 6mm;letter-spacing:1px}
.cv-pagina h2{font-size:13px;font-weight:bold;color:#1d4ed8;border-bottom:1px solid #94a3b8;margin:4mm 0 2mm;padding-bottom:1mm}
.cv-datos{width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:2mm}
.cv-datos th{text-align:left;width:44mm;background:#eef2f8;font-weight:bold}
.cv-datos th,.cv-datos td{border:1px solid #94a3b8;padding:1.2mm 2mm;vertical-align:top}
.cv-texto{text-align:justify;line-height:1.55;margin:0 0 2.5mm}
.cv-lista{margin:0 0 2mm;padding-left:5mm;line-height:1.5}
.cv-cols{columns:2;column-gap:8mm}
.cv-tabla{width:100%;border-collapse:collapse;font-size:10.5px}
.cv-tabla th{background:#dbe8f6}
.cv-tabla th,.cv-tabla td{border:1px solid #333;padding:1.3mm 1.6mm;vertical-align:top;text-align:left}
.cv-tabla td:nth-child(5){white-space:nowrap;text-align:right}
.cv-firma{margin-top:auto;text-align:center;line-height:1.35;padding-top:5mm}
.cv-firma p{margin:0 0 2mm;font-weight:bold;letter-spacing:2px}
.cv-firma-bloque{text-align:center;line-height:1.35}
.cv-firma-leyenda{margin:0 0 2mm;font-weight:bold;letter-spacing:2px}
.cv-firma-img{display:block;height:24mm;margin:1mm auto -12mm;position:relative;z-index:1}
.cv-linea{width:64mm;border-bottom:1px solid #333;margin:10mm auto 2mm}
@media print{
  @page{size:letter;margin:0}
  body *{visibility:hidden!important}
  .cv-print,.cv-print *{visibility:visible!important}
  .cv-print{position:absolute;left:0;top:0}
  .cv-pagina{margin:0;box-shadow:none;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cv-noprint{display:none!important}
}`

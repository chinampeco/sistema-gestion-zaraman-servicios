"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { useCurriculum, type DatosCurriculum } from "@/components/curriculum/use-curriculum"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { formatoMoneda } from "@/lib/contratos"
import { periodo, type Experiencia } from "@/lib/curriculum"
import { useStore } from "@/lib/store"

interface EmpresaImpresion {
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

const FILAS_POR_HOJA = 9

export default function CurriculumImprimirPage() {
  const { empresaActiva } = useStore()
  const { datos } = useCurriculum(empresaActiva?.id)
  const [empresa, setEmpresa] = React.useState<EmpresaImpresion | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [soloRecientes, setSoloRecientes] = React.useState(true)
  const [conFirma, setConFirma] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/empresa-curriculum/impresion")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? "No se pudieron cargar los datos.")
        setEmpresa(d.empresa)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los datos."))
  }, [empresaActiva?.id])

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS}</style>
      <div className="cv-noprint flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="outline" render={<Link href="/documentos-empresa/curriculum" />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Editar currículum
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="cv-rec" checked={soloRecientes} onCheckedChange={setSoloRecientes} />
          <Label htmlFor="cv-rec">Solo contratos de los últimos 5 años</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="cv-firma" checked={conFirma} onCheckedChange={setConFirma} />
          <Label htmlFor="cv-firma">Con firma del representante</Label>
        </div>
        <Button className="sm:ml-auto" onClick={() => window.print()} disabled={!datos || !empresa}>
          <Printer data-icon="inline-start" />
          Imprimir / Guardar PDF
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!datos || !empresa ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <div className="cv-print overflow-x-auto">
          <Documento datos={datos} empresa={empresa} soloRecientes={soloRecientes} conFirma={conFirma} />
        </div>
      )}
    </div>
  )
}

function Documento({
  datos,
  empresa,
  soloRecientes,
  conFirma,
}: {
  datos: DatosCurriculum
  empresa: EmpresaImpresion
  soloRecientes: boolean
  conFirma: boolean
}) {
  const cv = datos.curriculum
  const hoy = new Date()
  const limite = `${hoy.getFullYear() - 5}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
  const experiencia = datos.experiencia.filter((e) => !soloRecientes || (e.fin || e.inicio) >= limite)
  const grupos: Experiencia[][] = []
  for (let i = 0; i < experiencia.length; i += FILAS_POR_HOJA) grupos.push(experiencia.slice(i, i + FILAS_POR_HOJA))
  const razon = empresa.razonSocial || empresa.nombreComercial

  const firma = conFirma && (
    <div className="cv-firma">
      <p>A T E N T A M E N T E</p>
      {empresa.firma && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={empresa.firma} alt="" className="cv-firma-img" />
      )}
      <div className="cv-linea" />
      <b>{empresa.representanteLegal || "Representante legal"}</b>
      <br />
      {empresa.representanteCargo || "Representante legal"}
      <br />
      {razon}
    </div>
  )

  return (
    <>
      <Hoja empresa={empresa}>
        <h1 className="cv-titulo">CURRÍCULUM EMPRESARIAL</h1>
        <table className="cv-datos">
          <tbody>
            <tr><th>Razón social</th><td>{razon}</td></tr>
            <tr><th>RFC</th><td>{empresa.rfc || "—"}</td></tr>
            <tr><th>Domicilio fiscal</th><td>{empresa.domicilio || "—"}</td></tr>
            <tr><th>Teléfono / correo</th><td>{[empresa.telefono, empresa.email].filter(Boolean).join(" · ") || "—"}</td></tr>
            <tr><th>Representante legal</th><td>{empresa.representanteLegal || "—"}</td></tr>
            {empresa.giro && <tr><th>Giro</th><td>{empresa.giro}</td></tr>}
          </tbody>
        </table>
        {cv.semblanza && (
          <>
            <h2>Presentación</h2>
            {cv.semblanza.split(/\n+/).map((p, i) => (
              <p key={i} className="cv-texto">{p}</p>
            ))}
          </>
        )}
        {cv.especialidades.length > 0 && (
          <>
            <h2>Especialidades</h2>
            <ul className="cv-lista cv-cols">
              {cv.especialidades.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </>
        )}
      </Hoja>

      <Hoja empresa={empresa}>
        {cv.certificaciones.length > 0 && (
          <>
            <h2>Certificaciones y registros</h2>
            <ul className="cv-lista">
              {cv.certificaciones.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </>
        )}
        {cv.infraestructura && (
          <>
            <h2>Infraestructura, herramientas y equipo</h2>
            <p className="cv-texto">{cv.infraestructura}</p>
          </>
        )}
        <h2>Personal técnico</h2>
        <p className="cv-texto">
          La empresa cuenta con {datos.personal.total} técnicos en activo
          {datos.personal.conCedula ? `, ${datos.personal.conCedula} de ellos con cédula profesional` : ""}
          {datos.personal.puestos.length ? ` (${datos.personal.puestos.map(([p, n]) => `${n} ${p.toLocaleLowerCase("es-MX")}`).join(", ")})` : ""}.
          {datos.personal.especialidades.length ? ` Áreas de especialidad: ${datos.personal.especialidades.join(", ")}.` : ""}
        </p>
        {grupos.length === 0 && firma}
      </Hoja>

      {grupos.map((g, i) => (
        <Hoja key={i} empresa={empresa}>
          <h2>Relación de contratos{grupos.length > 1 ? ` (${i + 1} de ${grupos.length})` : ""}</h2>
          <table className="cv-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Objeto</th>
                <th>Periodo</th>
                <th>Monto con IVA</th>
              </tr>
            </thead>
            <tbody>
              {g.map((e, j) => (
                <tr key={j}>
                  <td>{e.cliente}</td>
                  <td>{e.numero || "—"}</td>
                  <td>{e.objeto}</td>
                  <td>{periodo(e)}</td>
                  <td>{e.monto != null ? formatoMoneda(e.monto) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {i === grupos.length - 1 && firma}
        </Hoja>
      ))}
    </>
  )
}

function Hoja({ empresa, children }: { empresa: EmpresaImpresion; children: React.ReactNode }) {
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

const ESTILOS = `
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

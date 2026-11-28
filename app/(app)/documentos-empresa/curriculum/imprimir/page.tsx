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
import { ESTILOS_HOJA as ESTILOS, Hoja, useEmpresaImpresion, type EmpresaImpresion } from "@/components/impresion/hoja-membrete"
import { useStore } from "@/lib/store"

const FILAS_POR_HOJA = 9

export default function CurriculumImprimirPage() {
  const { empresaActiva } = useStore()
  const { datos } = useCurriculum(empresaActiva?.id)
  const { empresa, error } = useEmpresaImpresion(empresaActiva?.id)
  const [soloRecientes, setSoloRecientes] = React.useState(true)
  const [conFirma, setConFirma] = React.useState(true)


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


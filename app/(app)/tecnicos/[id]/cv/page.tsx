"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Printer } from "lucide-react"

import { ESTILOS_HOJA, FirmaRepresentante, Hoja, useEmpresaImpresion, type EmpresaImpresion } from "@/components/impresion/hoja-membrete"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { experienciaTecnico, periodoGrupo, type ContratoBreve, type GrupoExperiencia } from "@/lib/cv-tecnico"
import { formatFecha } from "@/lib/format"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import { mapDocumentoTecnico, type DocumentoTecnico } from "@/lib/tecnico-documentos"
import type { Tecnico } from "@/lib/types"

// Documentos del expediente que se listan como formación y capacitación.
const TIPOS_FORMACION = [
  "Cédula profesional",
  "Título / certificado de estudios",
  "Constancia DC-3",
  "Certificación / curso",
  "Licencia de manejo",
]
const CERT_POR_HOJA = 10
const EXP_POR_HOJA = 8

export default function CvTecnicoPage() {
  const { id } = useParams<{ id: string }>()
  const { tecnicos, ordenes, clientes, equipos, empresaActiva, cargando } = useStore()
  const tecnico = tecnicos.find((t) => t.id === id)
  const { empresa, error } = useEmpresaImpresion(empresaActiva?.id)
  const [docs, setDocs] = React.useState<DocumentoTecnico[] | null>(null)
  const [contratos, setContratos] = React.useState<ContratoBreve[]>([])
  const [contacto, setContacto] = React.useState(false)
  const [conExperiencia, setConExperiencia] = React.useState(true)
  const [conFirma, setConFirma] = React.useState(true)

  React.useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("tecnico_documentos").select("*").eq("tecnico_id", id).order("fecha_emision", { ascending: false }),
      supabase.from("contratos").select("id, numero_contrato, objeto"),
    ]).then(([d, c]) => {
      setDocs((d.data ?? []).map(mapDocumentoTecnico))
      setContratos((c.data ?? []).map((x: any) => ({ id: x.id, numero: x.numero_contrato ?? "", objeto: x.objeto ?? "" })))
    })
  }, [id])

  const listo = tecnico && empresa && docs

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS_HOJA + ESTILOS_CV}</style>
      <div className="cv-noprint flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="outline" render={<Link href={`/tecnicos/${id}`} />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Volver al técnico
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="cv-exp" checked={conExperiencia} onCheckedChange={setConExperiencia} />
          <Label htmlFor="cv-exp">Experiencia en el sistema</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="cv-contacto" checked={contacto} onCheckedChange={setContacto} />
          <Label htmlFor="cv-contacto">Teléfono y correo</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="cv-firma" checked={conFirma} onCheckedChange={setConFirma} />
          <Label htmlFor="cv-firma">Firma del representante</Label>
        </div>
        <Button className="sm:ml-auto" onClick={() => window.print()} disabled={!listo}>
          <Printer data-icon="inline-start" />
          Imprimir / Guardar PDF
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!tecnico && !cargando && <p className="text-sm text-muted-foreground">Técnico no encontrado en esta empresa.</p>}
      {!listo ? (
        <Skeleton className="h-[60vh]" />
      ) : (
        <div className="cv-print overflow-x-auto">
          <DocumentoCv
            tecnico={tecnico}
            empresa={empresa}
            docs={docs}
            experiencia={conExperiencia ? experienciaTecnico(tecnico.id, ordenes, clientes, equipos, contratos) : null}
            contacto={contacto}
            conFirma={conFirma}
          />
        </div>
      )}
    </div>
  )
}

function trozos<T>(lista: T[], n: number): T[][] {
  const r: T[][] = []
  for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n))
  return r
}

function DocumentoCv({
  tecnico: t,
  empresa,
  docs,
  experiencia,
  contacto,
  conFirma,
}: {
  tecnico: Tecnico
  empresa: EmpresaImpresion
  docs: DocumentoTecnico[]
  experiencia: { grupos: GrupoExperiencia[]; terminadas: number } | null
  contacto: boolean
  conFirma: boolean
}) {
  const p = t.perfil
  const formacion = docs.filter((d) => TIPOS_FORMACION.includes(d.tipo))
  const cedula = docs.find((d) => d.tipo === "Cédula profesional")
  // Certificaciones del perfil que no tienen documento en el expediente.
  const textoDocs = formacion.map((d) => `${d.descripcion} ${d.nombreArchivo}`.toLowerCase()).join(" ")
  const certSinDoc = (p?.certificaciones ?? []).filter((c) => !textoDocs.includes(c.toLowerCase().slice(0, 12)))
  const especialidades = [...new Set([...(p?.especialidades ?? []), ...t.especialidad.split(/[,;/]/).map((x) => x.trim())].filter(Boolean))]

  // Hojas siguientes: capacitación y experiencia, repartidas para que quepan.
  const hojas: React.ReactNode[] = []
  const gruposCert = trozos(formacion, CERT_POR_HOJA)
  const gruposExp = experiencia ? trozos(experiencia.grupos, EXP_POR_HOJA) : []
  gruposCert.forEach((g, i) =>
    hojas.push(
      <>
        <h2>Formación, capacitación y certificaciones{gruposCert.length > 1 ? ` (${i + 1} de ${gruposCert.length})` : ""}</h2>
        <table className="cv-tabla">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Descripción</th>
              <th>Emisión</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {g.map((d) => (
              <tr key={d.id}>
                <td>{d.tipo}</td>
                <td>{d.descripcion || d.nombreArchivo}</td>
                <td>{d.fechaEmision ? formatFecha(d.fechaEmision) : "—"}</td>
                <td>{d.vigenteHasta ? formatFecha(d.vigenteHasta) : "Permanente"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {i === gruposCert.length - 1 && certSinDoc.length > 0 && (
          <p className="cv-texto cv-nota">Otras capacitaciones: {certSinDoc.join("; ")}.</p>
        )}
      </>,
    ),
  )
  if (!gruposCert.length && certSinDoc.length) {
    hojas.push(
      <>
        <h2>Capacitación y certificaciones</h2>
        <ul className="cv-lista">{certSinDoc.map((c, i) => <li key={i}>{c}</li>)}</ul>
      </>,
    )
  }
  if (experiencia) {
    if (!gruposExp.length) {
      hojas.push(
        <>
          <h2>Experiencia en servicios</h2>
          <p className="cv-texto">Sin servicios terminados registrados en el sistema.</p>
        </>,
      )
    }
    gruposExp.forEach((g, i) =>
      hojas.push(
        <>
          <h2>
            Experiencia en servicios ({experiencia.terminadas} terminados){gruposExp.length > 1 ? ` · ${i + 1} de ${gruposExp.length}` : ""}
          </h2>
          <table className="cv-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Equipos atendidos</th>
                <th>Servicios</th>
                <th>Periodo</th>
              </tr>
            </thead>
            <tbody>
              {g.map((x) => (
                <tr key={x.clave}>
                  <td>{x.cliente || "—"}</td>
                  <td>
                    {x.contrato || "Servicio directo"}
                    {x.objeto && <span className="cv-sub">{x.objeto}</span>}
                  </td>
                  <td>{x.equipos.join(", ") || "—"}</td>
                  <td className="cv-num">{x.servicios}</td>
                  <td>{periodoGrupo(x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>,
      ),
    )
  }

  const firmas = (
    <div className="cv-firmas">
      <div className="cv-firma-bloque">
        <p className="cv-firma-leyenda">&nbsp;</p>
        <div className="cv-linea cv-linea-tec" />
        <b>{t.nombre}</b>
        <br />
        {t.rol}
      </div>
      {conFirma && <FirmaRepresentante empresa={empresa} leyenda="" />}
    </div>
  )

  return (
    <>
      <Hoja empresa={empresa}>
        <h1 className="cv-titulo">CURRÍCULUM VITAE</h1>
        <table className="cv-datos">
          <tbody>
            <tr><th>Nombre</th><td><b>{t.nombre}</b></td></tr>
            <tr><th>Puesto</th><td>{t.rol}</td></tr>
            {cedula && <tr><th>Cédula profesional</th><td>{cedula.descripcion || "Sí cuenta con cédula profesional"}</td></tr>}
            {!cedula && t.tieneCedula && <tr><th>Cédula profesional</th><td>Sí cuenta con cédula profesional</td></tr>}
            {p?.aniosExperiencia != null && <tr><th>Experiencia</th><td>{p.aniosExperiencia} años</td></tr>}
            {t.lugarOrigen && <tr><th>Lugar de residencia</th><td>{t.lugarOrigen}</td></tr>}
            {(t.regionesTrabajo ?? []).length > 0 && <tr><th>Disponibilidad</th><td>{t.regionesTrabajo!.join(", ")}</td></tr>}
            {contacto && (t.telefono || t.email) && (
              <tr><th>Contacto</th><td>{[t.telefono, t.email].filter(Boolean).join(" · ")}</td></tr>
            )}
            <tr><th>Empresa</th><td>{empresa.razonSocial || empresa.nombreComercial}</td></tr>
          </tbody>
        </table>
        {p?.resumen && (
          <>
            <h2>Perfil profesional</h2>
            <p className="cv-texto">{p.resumen}</p>
          </>
        )}
        {p?.estudios && (
          <>
            <h2>Formación académica</h2>
            <p className="cv-texto">{p.estudios}</p>
          </>
        )}
        {especialidades.length > 0 && (
          <>
            <h2>Especialidades</h2>
            <ul className="cv-lista cv-cols">{especialidades.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </>
        )}
        {((p?.equipos ?? []).length > 0 || (p?.marcas ?? []).length > 0) && (
          <>
            <h2>Equipos y marcas que atiende</h2>
            {(p?.equipos ?? []).length > 0 && <p className="cv-texto"><b>Equipos:</b> {p!.equipos.join(", ")}.</p>}
            {(p?.marcas ?? []).length > 0 && <p className="cv-texto"><b>Marcas:</b> {p!.marcas.join(", ")}.</p>}
          </>
        )}
        {hojas.length === 0 && firmas}
      </Hoja>
      {hojas.map((contenido, i) => (
        <Hoja key={i} empresa={empresa}>
          {contenido}
          {i === hojas.length - 1 && firmas}
        </Hoja>
      ))}
    </>
  )
}

const ESTILOS_CV = `
.cv-firmas{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:10mm;align-items:end;padding-top:6mm}
.cv-linea-tec{margin-top:22mm}
.cv-sub{display:block;font-size:9px;color:#444}
.cv-num{text-align:center}
.cv-nota{font-size:11px;margin-top:2mm}
`

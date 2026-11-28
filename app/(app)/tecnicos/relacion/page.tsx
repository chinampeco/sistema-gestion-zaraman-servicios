"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { ESTILOS_HOJA, FirmaRepresentante, Hoja, useEmpresaImpresion } from "@/components/impresion/hoja-membrete"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"

interface DocBreve {
  tecnicoId: string
  tipo: string
  descripcion: string
}

const CAPACITACION = ["Constancia DC-3", "Certificación / curso"]
const FILAS_POR_HOJA = 12

// Relación de personal técnico para licitaciones (p. ej. RI-SA-a de la N-702:
// "relación de empleados con el nombre completo de al menos 4 ingenieros").
export default function RelacionPersonalPage() {
  const { tecnicos, empresaActiva } = useStore()
  const { empresa, error } = useEmpresaImpresion(empresaActiva?.id)
  const activos = React.useMemo(() => tecnicos.filter((t) => t.activo).sort((a, b) => a.nombre.localeCompare(b.nombre)), [tecnicos])
  const [docs, setDocs] = React.useState<DocBreve[] | null>(null)
  const [seleccion, setSeleccion] = React.useState<Set<string> | null>(null)
  const [titulo, setTitulo] = React.useState("RELACIÓN DE PERSONAL TÉCNICO")
  const [conFirma, setConFirma] = React.useState(true)

  React.useEffect(() => {
    createClient()
      .from("tecnico_documentos")
      .select("tecnico_id, tipo, descripcion")
      .then(({ data }) => setDocs((data ?? []).map((d: any) => ({ tecnicoId: d.tecnico_id, tipo: d.tipo, descripcion: d.descripcion ?? "" }))))
  }, [empresaActiva?.id])

  // Por omisión: quienes tienen cédula profesional (los ingenieros).
  React.useEffect(() => {
    if (seleccion === null && activos.length) {
      const conCedula = activos.filter((t) => t.tieneCedula).map((t) => t.id)
      setSeleccion(new Set(conCedula.length ? conCedula : activos.map((t) => t.id)))
    }
  }, [activos, seleccion])

  const elegidos = activos.filter((t) => seleccion?.has(t.id))
  const hojas: (typeof elegidos)[] = []
  for (let i = 0; i < elegidos.length; i += FILAS_POR_HOJA) hojas.push(elegidos.slice(i, i + FILAS_POR_HOJA))
  if (!hojas.length) hojas.push([])

  const cedulaDe = (id: string) => docs?.find((d) => d.tecnicoId === id && d.tipo === "Cédula profesional")
  const capacitacionDe = (id: string) => (docs ?? []).filter((d) => d.tecnicoId === id && CAPACITACION.includes(d.tipo))

  return (
    <div className="flex flex-col gap-4">
      <style>{ESTILOS_HOJA + ESTILOS_RELACION}</style>
      <div className="cv-noprint flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" render={<Link href="/tecnicos" />} nativeButton={false}>
            <ArrowLeft data-icon="inline-start" />
            Técnicos
          </Button>
          <Button className="ml-auto" onClick={() => window.print()} disabled={!empresa || !docs || !elegidos.length}>
            <Printer data-icon="inline-start" />
            Imprimir / Guardar PDF
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">¿A quién incluir?</CardTitle>
            <CardDescription>
              Las convocatorias suelen pedir al menos 4 ingenieros con su cédula y constancias. Por omisión se marcan quienes
              tienen cédula profesional.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-label="Título del documento" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                  <Switch
                    id={`rel-${t.id}`}
                    checked={seleccion?.has(t.id) ?? false}
                    onCheckedChange={(v) =>
                      setSeleccion((s) => {
                        const n = new Set(s ?? [])
                        if (v) n.add(t.id)
                        else n.delete(t.id)
                        return n
                      })
                    }
                  />
                  <Label htmlFor={`rel-${t.id}`} className="flex flex-col items-start">
                    <span>{t.nombre}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {t.rol}
                      {t.tieneCedula ? " · con cédula" : ""}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rel-firma" checked={conFirma} onCheckedChange={setConFirma} />
              <Label htmlFor="rel-firma">Firma del representante</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {elegidos.length} seleccionado(s), {elegidos.filter((t) => t.tieneCedula).length} con cédula. Para el CV de cada uno
              entra a su ficha → “CV para licitación”.
            </p>
          </CardContent>
        </Card>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!empresa || !docs ? (
        <Skeleton className="h-[50vh]" />
      ) : (
        <div className="cv-print overflow-x-auto">
          {hojas.map((g, i) => (
            <Hoja key={i} empresa={empresa}>
              <h1 className="cv-titulo">{titulo}</h1>
              <table className="cv-tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nombre completo</th>
                    <th>Puesto</th>
                    <th>Especialidad</th>
                    <th>Cédula profesional</th>
                    <th>Constancias / certificaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {g.map((t, j) => {
                    const ced = cedulaDe(t.id)
                    const cap = capacitacionDe(t.id)
                    return (
                      <tr key={t.id}>
                        <td className="cv-num">{i * FILAS_POR_HOJA + j + 1}</td>
                        <td>{t.nombre}</td>
                        <td>{t.rol}</td>
                        <td>{t.especialidad || (t.perfil?.especialidades ?? []).slice(0, 2).join(", ") || "—"}</td>
                        <td>{ced ? ced.descripcion || "Sí" : t.tieneCedula ? "Sí" : "—"}</td>
                        <td>{cap.length ? cap.map((d) => d.descripcion || d.tipo).join("; ") : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {i === hojas.length - 1 && conFirma && (
                <div className="cv-firma">
                  <FirmaRepresentante empresa={empresa} />
                </div>
              )}
            </Hoja>
          ))}
        </div>
      )}
    </div>
  )
}

const ESTILOS_RELACION = `
.cv-num{text-align:center}
`

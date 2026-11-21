"use client"

import * as React from "react"
import { CheckCircle2, Download, HardDriveDownload, TriangleAlert } from "lucide-react"
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"

interface Indice {
  generado: string
  tablas: string[]
  archivos: { bucket: string; ruta: string; tamano: number; url: string }[]
}

const CLAVE_ULTIMO = "respaldo-ultimo"

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `Error ${r.status}`)
  return d as T
}

function leerUltimo(): string | null {
  try {
    return localStorage.getItem(CLAVE_ULTIMO)
  } catch {
    return null
  }
}

export function RespaldoSistema() {
  const [incluirArchivos, setIncluirArchivos] = React.useState(true)
  const [trabajando, setTrabajando] = React.useState(false)
  const [avance, setAvance] = React.useState(0)
  const [paso, setPaso] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [resultado, setResultado] = React.useState<{ tablas: number; filas: number; archivos: number; fallidos: string[]; peso: number } | null>(null)
  const [ultimo, setUltimo] = React.useState<string | null>(null)

  React.useEffect(() => setUltimo(leerUltimo()), [])

  async function generar() {
    setTrabajando(true)
    setError(null)
    setResultado(null)
    setAvance(0)
    try {
      setPaso("Preparando la lista de información…")
      const indice = await json<Indice>("/api/respaldo")
      const fecha = indice.generado.slice(0, 10)
      const carpeta = `respaldo-zaraman-${fecha}`
      const archivos = incluirArchivos ? indice.archivos : []
      const totalPasos = indice.tablas.length + archivos.length

      const partes: Uint8Array[] = []
      let falloZip: Error | null = null
      const zip = new Zip((err, chunk) => {
        if (err) falloZip = err
        else partes.push(chunk)
      })
      const agregarTexto = (ruta: string, texto: string) => {
        const f = new ZipDeflate(`${carpeta}/${ruta}`, { level: 6 })
        zip.add(f)
        f.push(strToU8(texto), true)
      }

      // 1. Datos: un JSON por tabla.
      const conteos: Record<string, number> = {}
      let hechos = 0
      let filasTotales = 0
      for (const tabla of indice.tablas) {
        setPaso(`Datos: ${tabla}`)
        const filas: unknown[] = []
        for (let desde = 0; ; ) {
          const bloque = await json<{ filas: unknown[]; siguiente: number; fin: boolean }>(
            `/api/respaldo?tabla=${encodeURIComponent(tabla)}&desde=${desde}`,
          )
          filas.push(...bloque.filas)
          if (bloque.fin || bloque.filas.length === 0) break
          desde = bloque.siguiente
        }
        conteos[tabla] = filas.length
        filasTotales += filas.length
        agregarTexto(`datos/${tabla}.json`, JSON.stringify(filas, null, 1))
        setAvance(Math.round((++hechos / totalPasos) * 100))
      }

      // 2. Archivos tal cual (PDF, imágenes…), sin volver a comprimir.
      const fallidos: string[] = []
      for (const a of archivos) {
        setPaso(`Archivos: ${a.ruta.split("/").pop()}`)
        try {
          if (!a.url) throw new Error("sin enlace")
          const r = await fetch(a.url)
          if (!r.ok) throw new Error(String(r.status))
          const datos = new Uint8Array(await r.arrayBuffer())
          const f = new ZipPassThrough(`${carpeta}/archivos/${a.bucket}/${a.ruta}`)
          zip.add(f)
          f.push(datos, true)
        } catch {
          fallidos.push(`${a.bucket}/${a.ruta}`)
        }
        setAvance(Math.round((++hechos / totalPasos) * 100))
      }

      // 3. Índice y explicación.
      agregarTexto(
        "manifiesto.json",
        JSON.stringify(
          {
            generado: indice.generado,
            tablas: conteos,
            archivos: archivos.filter((a) => !fallidos.includes(`${a.bucket}/${a.ruta}`)).map((a) => ({ bucket: a.bucket, ruta: a.ruta, tamano: a.tamano })),
            archivosNoDescargados: fallidos,
            incluyeArchivos: incluirArchivos,
          },
          null,
          1,
        ),
      )
      agregarTexto(
        "LEEME.txt",
        [
          `Respaldo del sistema de gestión — ${new Date(indice.generado).toLocaleString("es-MX")}`,
          "",
          "datos/       Un archivo .json por tabla con todos sus registros (empresas, clientes, contratos,",
          "             órdenes, técnicos, cotizaciones, facturas, bitácora, etc.).",
          "archivos/    Los documentos guardados (contratos, expedientes, evidencias), con su misma carpeta.",
          "manifiesto.json  Cuántos registros tiene cada tabla y la lista de archivos incluidos.",
          "",
          "No incluye contraseñas: las cuentas se vuelven a crear y cada persona define la suya.",
          "Guárdalo en un disco externo o una memoria USB y en un lugar distinto a la oficina.",
          "Contiene información confidencial de las empresas y sus clientes: no lo compartas.",
        ].join("\r\n"),
      )
      zip.end()
      if (falloZip) throw falloZip

      setPaso("Guardando el archivo…")
      const blob = new Blob(partes as BlobPart[], { type: "application/zip" })
      const enlace = document.createElement("a")
      enlace.href = URL.createObjectURL(blob)
      enlace.download = `${carpeta}.zip`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(enlace.href), 60_000)

      const ahora = new Date().toISOString()
      try {
        localStorage.setItem(CLAVE_ULTIMO, ahora)
      } catch {}
      setUltimo(ahora)
      setResultado({ tablas: indice.tablas.length, filas: filasTotales, archivos: archivos.length - fallidos.length, fallidos, peso: blob.size })
      setAvance(100)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el respaldo.")
    } finally {
      setTrabajando(false)
      setPaso("")
    }
  }

  const dias = ultimo ? Math.floor((Date.now() - new Date(ultimo).getTime()) / 86_400_000) : null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Descarga a tu equipo una copia completa: todos los datos de las empresas y, si quieres, los documentos guardados.
        Te recomendamos hacerlo cada semana y guardarlo en un disco externo o memoria USB fuera de la oficina.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="respaldo-archivos">Incluir documentos</Label>
          <span className="text-xs text-muted-foreground">
            Contratos, expedientes y evidencias. Hace el archivo más grande y tarda más.
          </span>
        </div>
        <Switch id="respaldo-archivos" checked={incluirArchivos} onCheckedChange={setIncluirArchivos} disabled={trabajando} />
      </div>

      {ultimo && (
        <p className={`text-sm ${dias !== null && dias > 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
          Último respaldo descargado en este equipo: {new Date(ultimo).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
          {dias !== null && dias > 7 ? ` (hace ${dias} días)` : ""}.
        </p>
      )}

      {trabajando && (
        <div className="flex flex-col gap-2">
          <Progress value={avance} />
          <span className="truncate text-xs text-muted-foreground">{paso}</span>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo generar el respaldo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {resultado && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Respaldo descargado ({mb(resultado.peso)})</AlertTitle>
          <AlertDescription>
            {resultado.tablas} tablas con {resultado.filas.toLocaleString("es-MX")} registros
            {incluirArchivos ? ` y ${resultado.archivos} documentos` : ""}.
            {resultado.fallidos.length > 0 &&
              ` No se pudieron descargar ${resultado.fallidos.length} documentos; vienen listados en manifiesto.json.`}
          </AlertDescription>
        </Alert>
      )}

      <Button onClick={generar} disabled={trabajando} className="self-start">
        {trabajando ? <HardDriveDownload data-icon="inline-start" /> : <Download data-icon="inline-start" />}
        {trabajando ? `Generando… ${avance}%` : "Descargar respaldo"}
      </Button>
    </div>
  )
}

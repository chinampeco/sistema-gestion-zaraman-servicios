"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, FileText, Sparkles, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import {
  NUEVA,
  OMITIR,
  RevisionOrdenFisica,
  type EquipoDeOrden,
  type Propuesta,
} from "@/components/ordenes/importacion/revision-orden-fisica"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { BUCKET_EXPEDIENTES, formatoTamano } from "@/lib/contratos"
import { MAX_BYTES_IMPORTACION, TIPOS_LECTURA } from "@/lib/importacion-contratos"
import type { ArchivoLote } from "@/lib/importacion-guardar"
import {
  clave,
  clavesEquiposLeidos,
  emparejarTecnico,
  MAX_ARCHIVOS_ORDENES,
  MAX_BYTES_TOTAL_ORDENES,
  type LecturaArchivo,
  type OrdenLeida,
} from "@/lib/importacion-ordenes"
import { guardarOrdenesFisicas, textoEntrega, type DestinoNuevaOrden } from "@/lib/importacion-ordenes-guardar"
import { puedeGestionarContratos } from "@/lib/permisos"
import { useStore } from "@/lib/store"
import { createClient } from "@/lib/supabase/client"
import type { ActividadOrden, OrdenServicio } from "@/lib/types"

type Paso = "subir" | "analizando" | "revision" | "guardando" | "listo"

const ACCEPT = "application/pdf,image/jpeg,image/png"
const TIPOS_ORDEN = ["application/pdf", "image/jpeg", "image/png"]

interface ContratoRef {
  id: string
  numero: string
  clienteId: string
}
interface PartidaRef {
  id: string
  contratoId: string
  numero: number
  descripcion: string
  actividades: ActividadOrden[]
}

function etiquetaEquipo(e: Record<string, any>): string {
  const ids = [e.numero_inventario && `Inv./S.I.L. ${e.numero_inventario}`, e.numero_serie && `Serie ${e.numero_serie}`]
  return [[e.tipo, e.marca, e.modelo].filter(Boolean).join(" "), ...ids].filter(Boolean).join(" · ") || "Equipo"
}

function aEquipo(e: Record<string, any>): EquipoDeOrden {
  return {
    id: e.id,
    etiqueta: etiquetaEquipo(e),
    claves: [e.numero_inventario, e.numero_serie].map((v) => clave(String(v ?? ""))).filter((k) => k.length >= 4),
  }
}

export default function ImportarOrdenesPage() {
  const { ordenes, tecnicos, usuarioActual, empresaActiva } = useStore()
  const [paso, setPaso] = React.useState<Paso>("subir")
  const [archivos, setArchivos] = React.useState<File[]>([])
  const [lote, setLote] = React.useState<{ id: string; archivos: ArchivoLote[] } | null>(null)
  const [propuestas, setPropuestas] = React.useState<Propuesta[]>([])
  const [advertencias, setAdvertencias] = React.useState<string[]>([])
  const [contratos, setContratos] = React.useState<ContratoRef[]>([])
  const [partidas, setPartidas] = React.useState<PartidaRef[]>([])
  // Equipos por orden (o por cliente, para órdenes nuevas), cargados bajo demanda.
  const [equiposPorOrden, setEquiposPorOrden] = React.useState<Record<string, EquipoDeOrden[]>>({})
  const [mensaje, setMensaje] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [resultado, setResultado] = React.useState<{ pasos: string[]; errores: string[] } | null>(null)

  const totalBytes = archivos.reduce((s, f) => s + f.size, 0)
  const ordenesEmpresa = React.useMemo(
    () => ordenes.filter((o) => o.estado !== "Cancelada").sort((a, b) => b.folio.localeCompare(a.folio)),
    [ordenes],
  )

  if (!puedeGestionarContratos(usuarioActual.rol)) {
    return (
      <Alert>
        <AlertTitle>Sin permiso</AlertTitle>
        <AlertDescription>Solo Administrador, Coordinador o Supervisor pueden importar órdenes.</AlertDescription>
      </Alert>
    )
  }

  function agregar(lista: FileList | null) {
    if (!lista) return
    const nuevos: File[] = []
    for (const f of Array.from(lista)) {
      if (!TIPOS_ORDEN.includes(f.type) || !(f.type in TIPOS_LECTURA)) {
        toast.error(`“${f.name}”: usa PDF o foto (JPG / PNG).`)
        continue
      }
      if (f.size > MAX_BYTES_IMPORTACION) {
        toast.error(`“${f.name}” pesa más de ${MAX_BYTES_IMPORTACION / 1024 / 1024} MB.`)
        continue
      }
      nuevos.push(f)
    }
    setArchivos((prev) => [...prev, ...nuevos].slice(0, MAX_ARCHIVOS_ORDENES))
  }

  async function limpiarLote(id: string) {
    await fetch("/api/contratos/importacion/limpiar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote: id }),
    }).catch(() => undefined)
  }

  /** Equipos ligados a una orden existente. */
  async function cargarEquiposOrden(ordenId: string): Promise<EquipoDeOrden[]> {
    if (equiposPorOrden[ordenId]) return equiposPorOrden[ordenId]
    const { data } = await createClient()
      .from("orden_equipos")
      .select("equipo_id, equipos(id, tipo, marca, modelo, numero_serie, numero_inventario)")
      .eq("orden_id", ordenId)
    const lista = (data ?? []).map((r: any) => aEquipo(r.equipos ?? { id: r.equipo_id }))
    setEquiposPorOrden((prev) => ({ ...prev, [ordenId]: lista }))
    return lista
  }

  /** Equipos del cliente que aparecen en la hoja (para una orden nueva). */
  async function cargarEquiposCliente(clienteId: string, claves: Set<string>): Promise<EquipoDeOrden[]> {
    const { data } = await createClient()
      .from("equipos")
      .select("id, tipo, marca, modelo, numero_serie, numero_inventario")
      .eq("cliente_id", clienteId)
    return (data ?? []).map(aEquipo).filter((e) => e.claves.some((c) => claves.has(c)))
  }

  /** Arma la propuesta de una orden leída: orden destino, técnico, equipos y actividades. */
  async function proponer(
    leida: OrdenLeida,
    archivoIndice: number,
    archivoNombre: string,
    key: string,
    refs: { contratos: ContratoRef[]; partidas: PartidaRef[] },
  ): Promise<Propuesta> {
    const claves = clavesEquiposLeidos(leida.equipos)
    const contrato = leida.numero_contrato
      ? refs.contratos.find((c) => clave(c.numero) === clave(leida.numero_contrato))
      : undefined
    const partida =
      contrato && leida.partida ? refs.partidas.find((p) => p.contratoId === contrato.id && p.numero === leida.partida) : undefined

    const orden: OrdenServicio | undefined =
      (leida.referencia && ordenesEmpresa.find((o) => o.referencia && clave(o.referencia) === clave(leida.referencia))) ||
      (leida.folio && ordenesEmpresa.find((o) => clave(o.folio) === clave(leida.folio))) ||
      (partida && ordenesEmpresa.find((o) => o.contratoPartidaId === partida.id)) ||
      undefined
    const nueva: DestinoNuevaOrden | null =
      !orden && contrato && partida
        ? {
            contratoId: contrato.id,
            partidaId: partida.id,
            clienteId: contrato.clienteId,
            referencia: leida.referencia,
            descripcion: `Partida ${partida.numero}: ${partida.descripcion}`,
          }
        : null

    let equipos: Record<string, boolean> = {}
    if (orden) {
      const lista = await cargarEquiposOrden(orden.id)
      // Sin números legibles en la hoja, se proponen todos los equipos como realizados.
      equipos = Object.fromEntries(lista.map((e) => [e.id, claves.size === 0 || e.claves.some((c) => claves.has(c))]))
    } else if (nueva) {
      const lista = await cargarEquiposCliente(nueva.clienteId, claves)
      setEquiposPorOrden((prev) => ({ ...prev, [`${NUEVA}:${key}`]: lista }))
      equipos = Object.fromEntries(lista.map((e) => [e.id, true]))
    }

    const actividadesDestino = orden?.actividades ?? partida?.actividades ?? []
    const actividades = Object.fromEntries(
      actividadesDestino.map((a) => {
        const leidaAct = leida.actividades.find((x) => x.numero === a.numero)
        return [a.numero, leidaAct ? leidaAct.realizada : leida.firmada]
      }),
    )

    const tecnicosLeidos = leida.tecnicos.map((n) => emparejarTecnico(n, tecnicos)).filter(Boolean)
    const tecnico = tecnicosLeidos[0] ?? null
    const fechaCierre = leida.fecha || new Date().toISOString().slice(0, 10)
    return {
      key,
      archivoIndice,
      archivoNombre,
      leida,
      incluir: !!(orden || nueva),
      ordenId: orden?.id ?? null,
      nueva,
      tecnicoId: tecnico?.id ?? null,
      tecnicoNombre: tecnico?.nombre ?? "",
      fechaCierre,
      equipos,
      actividades,
      observaciones: textoEntrega(leida, fechaCierre),
    }
  }

  async function analizar() {
    setError(null)
    if (archivos.length === 0) return setError("Agrega las órdenes escaneadas.")
    if (totalBytes > MAX_BYTES_TOTAL_ORDENES)
      return setError(`Los archivos suman más de ${MAX_BYTES_TOTAL_ORDENES / 1024 / 1024} MB.`)

    setPaso("analizando")
    setMensaje("Subiendo archivos…")
    const supabase = createClient()
    let loteId: string | null = null
    try {
      const r1 = await fetch("/api/contratos/importacion/subida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "ordenes",
          archivos: archivos.map((f) => ({ nombre: f.name, tipo: f.type, tamano: f.size })),
        }),
      })
      const d1 = await r1.json()
      if (!r1.ok) throw new Error(d1.error ?? "No se pudo preparar la subida.")
      loteId = d1.lote as string
      const subidas: { indice: number; ruta: string; token: string }[] = d1.subidas
      for (const s of subidas) {
        const f = archivos[s.indice]
        const { error: e } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .uploadToSignedUrl(s.ruta, s.token, f, { contentType: f.type })
        if (e) throw new Error(`No se pudo subir “${f.name}”.`)
      }
      const archivosLote: ArchivoLote[] = subidas.map((s) => ({
        indice: s.indice,
        nombre: archivos[s.indice].name,
        tipo: archivos[s.indice].type,
        tamano: archivos[s.indice].size,
        ruta: s.ruta,
      }))
      setLote({ id: loteId, archivos: archivosLote })

      // Contratos y partidas de la empresa, para ligar cada hoja a su partida.
      const [{ data: cs }, { data: ps }] = await Promise.all([
        supabase.from("contratos").select("id, numero_contrato, cliente_id"),
        supabase.from("contrato_partidas").select("id, contrato_id, numero, descripcion, actividades"),
      ])
      const refs = {
        contratos: (cs ?? []).map((c: any) => ({ id: c.id, numero: c.numero_contrato ?? "", clienteId: c.cliente_id })),
        partidas: (ps ?? []).map((p: any) => ({
          id: p.id,
          contratoId: p.contrato_id,
          numero: Number(p.numero),
          descripcion: p.descripcion ?? "",
          actividades: (Array.isArray(p.actividades) ? p.actividades : []).map((a: any, j: number) => ({
            numero: Number(a?.numero) || j + 1,
            titulo: String(a?.titulo ?? ""),
            detalle: [],
            operativo: "",
            realizada: false,
          })),
        })),
      }
      setContratos(refs.contratos)
      setPartidas(refs.partidas)

      // Cada archivo se lee por separado (así ninguno se pasa del tiempo límite).
      const nuevas: Propuesta[] = []
      const avisos: string[] = []
      for (const a of archivosLote) {
        setMensaje(`Leyendo “${a.nombre}” (${a.indice + 1} de ${archivosLote.length})…`)
        const r2 = await fetch("/api/ordenes/importacion/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lote: loteId, indice: a.indice, nombre: a.nombre }),
        })
        const d2 = await r2.json().catch(() => ({ error: "La lectura tardó demasiado o se interrumpió." }))
        if (!r2.ok) {
          avisos.push(`“${a.nombre}”: ${d2.error ?? "no se pudo leer."}`)
          continue
        }
        const lectura: LecturaArchivo = d2.lectura
        lectura.advertencias.forEach((w) => avisos.push(`“${a.nombre}”: ${w}`))
        if (lectura.ordenes.length === 0) avisos.push(`“${a.nombre}”: no se encontró ninguna orden de servicio.`)
        for (const [j, o] of lectura.ordenes.entries()) {
          nuevas.push(await proponer(o, a.indice, a.nombre, `${a.indice}-${j}`, refs))
        }
      }
      if (nuevas.length === 0) throw new Error(avisos[0] ?? "No se encontró ninguna orden en los archivos.")
      setPropuestas(nuevas)
      setAdvertencias(avisos)
      setPaso("revision")
    } catch (e) {
      if (loteId) await limpiarLote(loteId)
      setLote(null)
      setError(e instanceof Error ? e.message : "Ocurrió un error.")
      setPaso("subir")
    }
  }

  function actualizar(p: Propuesta) {
    setPropuestas((prev) => prev.map((x) => (x.key === p.key ? p : x)))
  }

  /** El usuario elige otra orden destino (o crear / no registrar). */
  async function cambiarOrden(p: Propuesta, valor: string) {
    if (valor === OMITIR) return actualizar({ ...p, incluir: false })
    if (valor === NUEVA) {
      const lista = equiposPorOrden[`${NUEVA}:${p.key}`] ?? []
      return actualizar({ ...p, incluir: true, ordenId: null, equipos: Object.fromEntries(lista.map((e) => [e.id, true])) })
    }
    const orden = ordenesEmpresa.find((o) => o.id === valor)
    const claves = clavesEquiposLeidos(p.leida.equipos)
    actualizar({ ...p, incluir: true, ordenId: valor, equipos: {} })
    const lista = await cargarEquiposOrden(valor)
    actualizar({
      ...p,
      incluir: true,
      ordenId: valor,
      equipos: Object.fromEntries(lista.map((e) => [e.id, claves.size === 0 || e.claves.some((c) => claves.has(c))])),
      actividades: Object.fromEntries(
        (orden?.actividades ?? []).map((a) => [
          a.numero,
          p.leida.actividades.find((x) => x.numero === a.numero)?.realizada ?? p.leida.firmada,
        ]),
      ),
    })
  }

  async function confirmar() {
    if (!lote || !empresaActiva) return
    const elegidas = propuestas.filter((p) => p.incluir && (p.ordenId || p.nueva))
    if (elegidas.length === 0) return setError("No hay ninguna orden marcada para registrar.")
    const repetidas = elegidas.filter((p, i) => p.ordenId && elegidas.findIndex((q) => q.ordenId === p.ordenId) !== i)
    if (repetidas.length) return setError("Dos hojas apuntan a la misma orden del sistema. Corrige una de ellas.")
    setError(null)
    setPaso("guardando")
    const r = await guardarOrdenesFisicas(
      createClient(),
      elegidas,
      lote.archivos,
      { id: usuarioActual.id, nombre: usuarioActual.nombre, empresaId: empresaActiva.id },
      setMensaje,
    )
    await limpiarLote(lote.id)
    setResultado(r)
    setPaso("listo")
  }

  async function cancelar() {
    if (lote) await limpiarLote(lote.id)
    setLote(null)
    setPropuestas([])
    setAdvertencias([])
    setArchivos([])
    setError(null)
    setPaso("subir")
  }

  const actividadesDe = (p: Propuesta): ActividadOrden[] => {
    if (p.ordenId) return ordenesEmpresa.find((o) => o.id === p.ordenId)?.actividades ?? []
    if (p.nueva) return partidas.find((x) => x.id === p.nueva?.partidaId)?.actividades ?? []
    return []
  }
  const equiposDe = (p: Propuesta): EquipoDeOrden[] | undefined =>
    p.ordenId ? equiposPorOrden[p.ordenId] : p.nueva ? equiposPorOrden[`${NUEVA}:${p.key}`] ?? [] : []
  const marcadas = propuestas.filter((p) => p.incluir && (p.ordenId || p.nueva)).length

  return (
    <>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" render={<Link href="/ordenes" />} nativeButton={false} aria-label="Volver">
          <ArrowLeft />
        </Button>
        <PageHeader
          title="Importar órdenes físicas"
          description="Sube las órdenes de servicio ya firmadas (escaneadas o en foto). La IA las lee, las liga a su orden, técnico y equipos, y las cierras después de revisarlas."
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo completar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {paso === "subir" && (
        <Card>
          <CardHeader>
            <CardTitle>Órdenes firmadas de {empresaActiva?.nombreComercial ?? "la empresa"}</CardTitle>
            <CardDescription>
              PDF o fotos (JPG / PNG). Hasta {MAX_ARCHIVOS_ORDENES} archivos por lote; un archivo puede traer varias órdenes.
              Primero registra el contrato para que cada orden se ligue a su partida y equipos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/40">
              <Upload className="size-8 text-muted-foreground" />
              <span className="font-medium">Elige o arrastra las órdenes</span>
              <span className="text-sm text-muted-foreground">Escaneo o foto de cada orden firmada</span>
              <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { agregar(e.target.files); e.target.value = "" }} />
            </label>
            {archivos.length > 0 && (
              <ul className="flex flex-col divide-y rounded-lg border">
                {archivos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{formatoTamano(f.size)}</span>
                    <Button variant="ghost" size="icon-sm" aria-label={`Quitar ${f.name}`} onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button className="self-start" onClick={analizar} disabled={archivos.length === 0}>
              <Sparkles data-icon="inline-start" />
              Leer órdenes con IA
            </Button>
          </CardContent>
        </Card>
      )}

      {(paso === "analizando" || paso === "guardando") && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner className="size-8" />
            <p className="font-medium">{mensaje}</p>
            <p className="text-sm text-muted-foreground">No cierres esta página.</p>
          </CardContent>
        </Card>
      )}

      {paso === "revision" && (
        <>
          {advertencias.length > 0 && (
            <Alert>
              <AlertTitle>Revisa estos puntos</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5">
                  {advertencias.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {propuestas.map((p) => (
            <RevisionOrdenFisica
              key={p.key}
              propuesta={p}
              onChange={actualizar}
              onOrden={(v) => void cambiarOrden(p, v)}
              ordenes={ordenesEmpresa}
              tecnicos={tecnicos}
              equipos={equiposDe(p)}
              actividades={actividadesDe(p)}
              clavesLeidas={clavesEquiposLeidos(p.leida.equipos)}
            />
          ))}
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-6">
              <Button onClick={confirmar} disabled={marcadas === 0}>
                <CheckCircle2 data-icon="inline-start" />
                Cerrar {marcadas} orden(es)
              </Button>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
              <span className="text-sm text-muted-foreground">
                Quedan como Terminadas y cada escaneo se guarda en el expediente de su contrato
                {contratos.length === 0 ? " (esta empresa aún no tiene contratos registrados)" : ""}.
              </span>
            </CardContent>
          </Card>
        </>
      )}

      {paso === "listo" && resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              {resultado.errores.length ? "Registro parcial" : "Órdenes cerradas"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="list-disc pl-5 text-sm">
              {resultado.pasos.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            {resultado.errores.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>No se completó</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5">
                    {resultado.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Button
              className="self-start"
              onClick={() => {
                // Recarga completa para que el resto de la app vea las órdenes cerradas.
                window.location.assign("/ordenes")
              }}
            >
              Ver órdenes
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}

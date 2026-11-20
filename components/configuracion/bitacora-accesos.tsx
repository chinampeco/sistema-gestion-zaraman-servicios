"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"

interface Registro {
  id: string
  created_at: string
  email: string
  nombre: string
  rol: string
  evento: string
  exito: boolean
  ip: string
  ubicacion: string
  dispositivo: string
  detalle: string
  nuevo_lugar: boolean
}

const EVENTOS = [
  "Inicio de sesión",
  "Verificación en dos pasos",
  "Cierre de sesión",
  "Cambio de contraseña",
  "Contraseña restablecida",
  "Verificación reiniciada",
  "Bloqueo temporal",
]

const PERIODOS = [
  { value: "1", label: "Hoy" },
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
]

const POR_PAGINA = 100

function desdeDias(dias: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (dias - 1))
  return d.toISOString()
}

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })

export function BitacoraAccesos() {
  const [registros, setRegistros] = React.useState<Registro[]>([])
  const [cargando, setCargando] = React.useState(true)
  const [hayMas, setHayMas] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [periodo, setPeriodo] = React.useState("7")
  const [evento, setEvento] = React.useState("todos")
  const [texto, setTexto] = React.useState("")
  const [soloAlertas, setSoloAlertas] = React.useState(false)
  const [resumen, setResumen] = React.useState({ hoy: 0, fallidos: 0, nuevos: 0 })

  const cargar = React.useCallback(
    async (desde = 0) => {
      setCargando(true)
      setError(null)
      const supabase = createClient()
      let q = supabase
        .from("bitacora_accesos")
        .select("id, created_at, email, nombre, rol, evento, exito, ip, ubicacion, dispositivo, detalle, nuevo_lugar")
        .gte("created_at", desdeDias(Number(periodo)))
        .order("created_at", { ascending: false })
        .range(desde, desde + POR_PAGINA - 1)
      if (evento !== "todos") q = q.eq("evento", evento)
      if (soloAlertas) q = q.or("exito.eq.false,nuevo_lugar.eq.true")
      const t = texto.trim().replace(/[%,()]/g, "")
      if (t) q = q.or(`nombre.ilike.%${t}%,email.ilike.%${t}%,ip.ilike.%${t}%,ubicacion.ilike.%${t}%`)
      const { data, error: e } = await q
      setCargando(false)
      if (e) return setError("No se pudo cargar la bitácora.")
      const filas = (data ?? []) as Registro[]
      setRegistros((prev) => (desde === 0 ? filas : [...prev, ...filas]))
      setHayMas(filas.length === POR_PAGINA)
    },
    [periodo, evento, soloAlertas, texto],
  )

  const cargarResumen = React.useCallback(async () => {
    const supabase = createClient()
    const contar = (f: (q: any) => any) =>
      f(supabase.from("bitacora_accesos").select("id", { count: "exact", head: true })).then((r: any) => r.count ?? 0)
    const [hoy, fallidos, nuevos] = await Promise.all([
      contar((q) => q.eq("evento", "Inicio de sesión").eq("exito", true).gte("created_at", desdeDias(1))),
      contar((q) => q.eq("exito", false).gte("created_at", desdeDias(7))),
      contar((q) => q.eq("nuevo_lugar", true).gte("created_at", desdeDias(30))),
    ])
    setResumen({ hoy, fallidos, nuevos })
  }, [])

  React.useEffect(() => {
    const id = setTimeout(() => void cargar(0), texto ? 350 : 0)
    return () => clearTimeout(id)
  }, [cargar, texto])

  React.useEffect(() => {
    void cargarResumen()
  }, [cargarResumen])

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Resumen titulo="Accesos hoy" valor={resumen.hoy} />
        <Resumen titulo="Intentos fallidos (7 días)" valor={resumen.fallidos} alerta={resumen.fallidos > 0} />
        <Resumen titulo="Desde lugar o equipo nuevo (30 días)" valor={resumen.nuevos} alerta={resumen.nuevos > 0} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, correo, IP o lugar"
            className="pl-8"
          />
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo((v as string) ?? "7")} items={PERIODOS}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={evento}
          onValueChange={(v) => setEvento((v as string) ?? "todos")}
          items={[{ value: "todos", label: "Todos los eventos" }, ...EVENTOS.map((e) => ({ value: e, label: e }))]}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los eventos</SelectItem>
            {EVENTOS.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="solo-alertas" checked={soloAlertas} onCheckedChange={setSoloAlertas} />
          <Label htmlFor="solo-alertas">Solo fallidos y lugares nuevos</Label>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="sm:ml-auto"
          onClick={() => {
            void cargar(0)
            void cargarResumen()
          }}
        >
          <RefreshCw data-icon="inline-start" />
          Actualizar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Lugar</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{fechaHora(r.created_at)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{r.nombre || r.email || "—"}</span>
                    <span className="text-xs text-muted-foreground">
                      {[r.nombre ? r.email : "", r.rol].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <span>{r.evento}</span>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={r.exito ? "success" : "destructive"}>{r.exito ? "Correcto" : "Fallido"}</Badge>
                      {r.nuevo_lugar && (
                        <Badge variant="warning">
                          <AlertTriangle />
                          Lugar o equipo nuevo
                        </Badge>
                      )}
                    </div>
                    {r.detalle && <span className="text-xs text-muted-foreground">{r.detalle}</span>}
                  </div>
                </TableCell>
                <TableCell>{r.ubicacion || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.dispositivo || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.ip || "—"}</TableCell>
              </TableRow>
            ))}
            {!cargando && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin registros en este periodo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {cargando && (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      )}
      {!cargando && hayMas && (
        <Button variant="outline" className="self-center" onClick={() => void cargar(registros.length)}>
          Cargar más
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        El lugar es aproximado (se calcula por la IP de la conexión). Los registros no se pueden modificar y se
        conservan un año.
      </p>
    </div>
  )
}

function Resumen({ titulo, valor, alerta }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className={`text-2xl font-semibold tabular-nums ${alerta ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {valor}
      </span>
    </div>
  )
}

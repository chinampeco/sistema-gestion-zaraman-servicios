"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import {
  MessageCircle,
  Send,
  Search,
  StickyNote,
  AlertTriangle,
  User2,
  ExternalLink,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import type { ConversacionWhatsApp, MensajeWhatsApp } from "@/lib/types"
import { formatFechaHora } from "@/lib/format"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function agruparConversaciones(
  mensajes: MensajeWhatsApp[],
  nombrePorTelefono: (m: MensajeWhatsApp) => string,
): ConversacionWhatsApp[] {
  const grupos = new Map<string, MensajeWhatsApp[]>()
  for (const m of mensajes) {
    const lista = grupos.get(m.telefono) ?? []
    lista.push(m)
    grupos.set(m.telefono, lista)
  }
  const conversaciones: ConversacionWhatsApp[] = []
  for (const [telefono, lista] of grupos) {
    const ordenados = [...lista].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    const ultimo = ordenados[ordenados.length - 1]
    const noLeidos = ordenados.filter(
      (m) => m.direccion === "Entrante" && !m.leido,
    ).length
    conversaciones.push({
      telefono,
      leadId: ultimo.leadId,
      clienteId: ultimo.clienteId,
      nombre: nombrePorTelefono(ultimo),
      ultimoMensaje: ultimo.mensaje,
      ultimaFecha: ultimo.createdAt,
      noLeidos,
      mensajes: ordenados,
    })
  }
  return conversaciones.sort(
    (a, b) => new Date(b.ultimaFecha).getTime() - new Date(a.ultimaFecha).getTime(),
  )
}

export default function WhatsAppPage() {
  const {
    mensajesWhatsApp,
    leads,
    clientes,
    enviarMensajeWhatsApp,
    agregarNotaWhatsApp,
    marcarConversacionLeida,
  } = useStore()

  const { data: estado } = useSWR<{ configurado: boolean; webhookConfigurado: boolean }>(
    "/api/whatsapp/estado",
    fetcher,
  )

  const [seleccionado, setSeleccionado] = React.useState<string | null>(null)
  const [busqueda, setBusqueda] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [modoNota, setModoNota] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const nombrePorTelefono = React.useCallback(
    (m: MensajeWhatsApp) => {
      if (m.clienteId) {
        const c = clientes.find((c) => c.id === m.clienteId)
        if (c) return c.nombre
      }
      if (m.leadId) {
        const l = leads.find((l) => l.id === m.leadId)
        if (l) return l.empresa || l.nombre
      }
      const porTelLead = leads.find((l) => l.telefono === m.telefono)
      if (porTelLead) return porTelLead.empresa || porTelLead.nombre
      const porTelCliente = clientes.find((c) => c.telefono === m.telefono)
      if (porTelCliente) return porTelCliente.nombre
      return m.telefono
    },
    [clientes, leads],
  )

  const conversaciones = React.useMemo(
    () => agruparConversaciones(mensajesWhatsApp, nombrePorTelefono),
    [mensajesWhatsApp, nombrePorTelefono],
  )

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return conversaciones
    return conversaciones.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        c.ultimoMensaje.toLowerCase().includes(q),
    )
  }, [conversaciones, busqueda])

  const activa = React.useMemo(
    () => conversaciones.find((c) => c.telefono === seleccionado) ?? null,
    [conversaciones, seleccionado],
  )

  const totalNoLeidos = conversaciones.reduce((acc, c) => acc + c.noLeidos, 0)

  // Al seleccionar una conversación con no leídos, la marca como leída.
  React.useEffect(() => {
    if (activa && activa.noLeidos > 0) {
      void marcarConversacionLeida(activa.telefono)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionado])

  // Auto-scroll al final del hilo cuando cambian los mensajes.
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activa?.mensajes.length, seleccionado])

  async function handleEnviar() {
    if (!activa || !texto.trim()) return
    setEnviando(true)
    const contexto = { leadId: activa.leadId, clienteId: activa.clienteId }
    if (modoNota) {
      await agregarNotaWhatsApp(activa.telefono, texto, contexto)
    } else {
      await enviarMensajeWhatsApp(activa.telefono, texto, contexto)
    }
    setTexto("")
    setEnviando(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      void handleEnviar()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="WhatsApp"
        description="Bandeja de conversaciones con leads y clientes vía WhatsApp Business."
        actions={
          totalNoLeidos > 0 ? (
            <Badge variant="secondary" className="gap-1.5">
              <MessageCircle className="size-3.5" />
              {totalNoLeidos} sin leer
            </Badge>
          ) : undefined
        }
      />

      {estado && !estado.configurado && (
        <Card className="flex items-start gap-3 border-amber-500/40 bg-amber-500/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">
              Configuración de WhatsApp pendiente
            </span>
            <span className="text-muted-foreground">
              Falta conectar la API de WhatsApp Business (variables{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">WHATSAPP_TOKEN</code> y{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                WHATSAPP_PHONE_NUMBER_ID
              </code>
              ). Puedes registrar la conversación y notas internas; los mensajes salientes
              quedarán como pendientes hasta completar la configuración.
            </span>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Lista de conversaciones */}
        <Card className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden p-0">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conversación..."
                className="pl-8"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {filtradas.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Sin conversaciones todavía.
              </div>
            ) : (
              <ul className="divide-y">
                {filtradas.map((c) => (
                  <li key={c.telefono}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(c.telefono)}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-muted/60",
                        seleccionado === c.telefono && "bg-muted",
                      )}
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User2 className="size-5" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{c.nombre}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatFechaHora(c.ultimaFecha)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {c.ultimoMensaje}
                          </span>
                          {c.noLeidos > 0 && (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                              {c.noLeidos}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </Card>

        {/* Hilo de conversación */}
        <Card className="flex h-[calc(100vh-13rem)] flex-col overflow-hidden p-0">
          {!activa ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Empty className="border-0">
                <MessageCircle className="size-10 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Selecciona una conversación para ver los mensajes.
                </p>
              </Empty>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User2 className="size-5" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-semibold">{activa.nombre}</span>
                    <span className="text-xs text-muted-foreground">{activa.telefono}</span>
                  </div>
                </div>
                {activa.leadId && (
                  <Button variant="outline" size="sm" render={<Link href={`/leads/${activa.leadId}`} />}>
                    <ExternalLink className="size-3.5" />
                    Ver lead
                  </Button>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
                {activa.mensajes.map((m) => (
                  <MensajeBurbuja key={m.id} mensaje={m} />
                ))}
              </div>

              <div className="border-t p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant={modoNota ? "outline" : "default"}
                    size="sm"
                    onClick={() => setModoNota(false)}
                  >
                    <Send className="size-3.5" />
                    Mensaje
                  </Button>
                  <Button
                    type="button"
                    variant={modoNota ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModoNota(true)}
                  >
                    <StickyNote className="size-3.5" />
                    Nota interna
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      modoNota
                        ? "Escribe una nota interna (no se envía al cliente)..."
                        : "Escribe un mensaje..."
                    }
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    type="button"
                    onClick={handleEnviar}
                    disabled={!texto.trim() || enviando}
                    className="shrink-0"
                  >
                    <Send className="size-4" />
                    {modoNota ? "Guardar" : "Enviar"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function MensajeBurbuja({ mensaje }: { mensaje: MensajeWhatsApp }) {
  if (mensaje.notaInterna) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
          <div className="mb-0.5 flex items-center gap-1.5 font-medium text-amber-700">
            <StickyNote className="size-3" />
            Nota interna
          </div>
          <p className="whitespace-pre-wrap">{mensaje.mensaje}</p>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {formatFechaHora(mensaje.createdAt)}
          </div>
        </div>
      </div>
    )
  }

  const saliente = mensaje.direccion === "Saliente"
  return (
    <div className={cn("flex", saliente ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm",
          saliente
            ? "bg-primary text-primary-foreground"
            : "border bg-card text-card-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{mensaje.mensaje}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 text-[10px]",
            saliente ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          <span>{formatFechaHora(mensaje.createdAt)}</span>
          {saliente && <span>· {mensaje.estado}</span>}
        </div>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { Printer } from "lucide-react"

import type { Cliente, Equipo, OrdenServicio, Tecnico } from "@/lib/types"
import { formatFecha, formatHora } from "@/lib/format"
import { Button } from "@/components/ui/button"

interface ReporteServicioPrintProps {
  orden: OrdenServicio
  cliente?: Cliente
  equipo?: Equipo
  tecnico?: Tecnico
}

export function ReporteServicioPrint({
  orden,
  cliente,
  equipo,
  tecnico,
}: ReporteServicioPrintProps) {
  const imprimir = () => window.print()

  return (
    <>
      <Button variant="outline" onClick={imprimir}>
        <Printer data-icon="inline-start" />
        Reporte PDF
      </Button>

      <div className="print-report hidden">
        <div className="print-header">
          <div>
            <div className="print-brand">ZARAMAN SERVICIOS</div>
            <div className="print-subtitle">Servicios Industriales</div>
          </div>
          <div className="print-title-block">
            <div className="print-document-title">REPORTE DE SERVICIO</div>
            <div className="print-folio">{orden.folio}</div>
          </div>
        </div>

        <div className="print-status-row">
          <span>Estado: <strong>{orden.estado}</strong></span>
          <span>Tipo: <strong>{orden.tipoServicio}</strong></span>
          <span>Prioridad: <strong>{orden.prioridad}</strong></span>
        </div>

        <section className="print-section">
          <h2>Datos del cliente</h2>
          <div className="print-grid print-grid-2">
            <Dato label="Cliente" value={cliente?.nombre} />
            <Dato label="RFC" value={cliente?.rfc} />
            <Dato label="Contacto" value={cliente?.contacto} />
            <Dato label="Teléfono" value={cliente?.telefono} />
            <Dato label="Correo" value={cliente?.email} />
            <Dato label="Dirección" value={cliente?.direccion} />
          </div>
        </section>

        <section className="print-section">
          <h2>Equipo</h2>
          <div className="print-grid print-grid-2">
            <Dato label="Equipo" value={equipo ? `${equipo.tipo} · ${equipo.marca} ${equipo.modelo}` : undefined} />
            <Dato label="Número de serie" value={equipo?.numeroSerie} />
            <Dato label="Capacidad" value={equipo?.capacidad} />
            <Dato label="Ubicación" value={equipo?.ubicacion} />
            <Dato label="Técnico responsable" value={tecnico?.nombre ?? "Sin asignar"} />
            <Dato label="Zona" value={tecnico?.zona} />
          </div>
        </section>

        <section className="print-section">
          <h2>Fechas del servicio</h2>
          <div className="print-grid print-grid-4">
            <Dato label="Solicitud" value={formatFecha(orden.fechaSolicitud)} />
            <Dato label="Programada" value={`${formatFecha(orden.fechaProgramada)}${orden.horaProgramada ? ` · ${formatHora(orden.horaProgramada)}` : ""}`} />
            <Dato label="Inicio" value={formatFecha(orden.fechaInicio)} />
            <Dato label="Cierre" value={formatFecha(orden.fechaCierre)} />
          </div>
        </section>

        <section className="print-section">
          <h2>Detalle del servicio</h2>
          <Bloque label="Descripción de la falla" value={orden.descripcionFalla} />
          <Bloque label="Diagnóstico" value={orden.diagnostico} />
          <Bloque label="Trabajo realizado" value={orden.trabajoRealizado} />
          <Bloque label="Observaciones" value={orden.observaciones} />
        </section>

        <section className="print-section">
          <h2>Materiales y refacciones</h2>
          {orden.materialesDetalle.length > 0 ? (
            <table className="print-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Código</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {orden.materialesDetalle.map((material) => (
                  <tr key={material.id}>
                    <td>{material.descripcion}</td>
                    <td>{material.codigo || "—"}</td>
                    <td>{material.cantidad}</td>
                    <td>{material.unidad || "—"}</td>
                    <td>{material.observaciones || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="print-muted">{orden.materiales || "Sin materiales registrados."}</p>
          )}
        </section>

        {orden.evidencias.length > 0 ? (
          <section className="print-section print-evidencias">
            <h2>Evidencias fotográficas</h2>
            <div className="print-evidence-grid">
              {orden.evidencias.map((evidencia) => (
                <figure key={evidencia.id}>
                  <img src={evidencia.url} alt={evidencia.descripcion || evidencia.fase} />
                  <figcaption>
                    <strong>{evidencia.fase}</strong>
                    {evidencia.descripcion ? ` · ${evidencia.descripcion}` : ""}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="print-section print-signatures">
          <h2>Conformidad</h2>
          <div className="print-signature-grid">
            <div>
              <div className="print-signature-box">
                {orden.firmaCliente ? <img src={orden.firmaCliente} alt="Firma del cliente" /> : null}
              </div>
              <div className="print-signature-line">Firma del cliente</div>
              {orden.firmaFecha ? <div className="print-muted">Fecha: {formatFecha(orden.firmaFecha)}</div> : null}
            </div>
            <div>
              <div className="print-signature-box" />
              <div className="print-signature-line">Firma del técnico</div>
              <div className="print-muted">{tecnico?.nombre ?? "Sin asignar"}</div>
            </div>
          </div>
        </section>

        <footer className="print-footer">
          <span>ZARAMAN SERVICIOS · Reporte de servicio</span>
          <span>{orden.folio}</span>
        </footer>
      </div>

      <style jsx global>{`
        .print-report { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
        .print-header { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; border-bottom:2px solid #111; padding-bottom:12px; }
        .print-brand { font-size:22px; font-weight:800; letter-spacing:.04em; }
        .print-subtitle { font-size:11px; color:#555; margin-top:2px; }
        .print-title-block { text-align:right; }
        .print-document-title { font-size:15px; font-weight:800; }
        .print-folio { font-size:13px; margin-top:4px; }
        .print-status-row { display:flex; gap:24px; padding:9px 0; border-bottom:1px solid #bbb; font-size:10px; }
        .print-section { margin-top:14px; page-break-inside:avoid; }
        .print-section h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; margin:0 0 7px; padding-bottom:4px; border-bottom:1px solid #bbb; }
        .print-grid { display:grid; gap:7px 18px; }
        .print-grid-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .print-grid-4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .print-data-label { display:block; font-size:8px; text-transform:uppercase; color:#666; margin-bottom:2px; }
        .print-data-value { font-size:10px; min-height:12px; }
        .print-block { margin-bottom:9px; }
        .print-block-label { font-size:9px; font-weight:700; margin-bottom:2px; }
        .print-block-value { font-size:10px; line-height:1.45; white-space:pre-wrap; }
        .print-table { width:100%; border-collapse:collapse; font-size:9px; }
        .print-table th,.print-table td { border:1px solid #bbb; padding:5px; text-align:left; vertical-align:top; }
        .print-table th { background:#f0f0f0; font-weight:700; }
        .print-muted { color:#666; font-size:9px; }
        .print-evidence-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        .print-evidence-grid figure { margin:0; page-break-inside:avoid; }
        .print-evidence-grid img { width:100%; height:150px; object-fit:cover; border:1px solid #bbb; }
        .print-evidence-grid figcaption { font-size:8px; margin-top:3px; }
        .print-signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:50px; }
        .print-signature-box { height:80px; border-bottom:1px solid #222; display:flex; align-items:flex-end; justify-content:center; }
        .print-signature-box img { max-width:90%; max-height:72px; object-fit:contain; }
        .print-signature-line { text-align:center; font-size:9px; margin-top:4px; }
        .print-footer { display:flex; justify-content:space-between; margin-top:18px; padding-top:7px; border-top:1px solid #bbb; font-size:8px; color:#666; }
        @media print {
          @page { size:A4; margin:12mm; }
          body { background:#fff !important; }
          body:has(.print-report) * { visibility:hidden !important; }
          body:has(.print-report) .print-report,
          body:has(.print-report) .print-report * { visibility:visible !important; }
          body:has(.print-report) .print-report { display:block !important; position:absolute !important; left:0 !important; top:0 !important; width:100% !important; }
        }
      `}</style>
    </>
  )
}

function Dato({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="print-data-label">{label}</span>
      <span className="print-data-value">{value || "—"}</span>
    </div>
  )
}

function Bloque({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="print-block">
      <div className="print-block-label">{label}</div>
      <div className="print-block-value">{value || "—"}</div>
    </div>
  )
}

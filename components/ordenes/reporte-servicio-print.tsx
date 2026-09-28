"use client"

import * as React from "react"
import { Printer } from "lucide-react"

import type { Cliente, Equipo, OrdenServicio, Tecnico } from "@/lib/types"
import { formatFecha, formatFechaHora, formatHora } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { getFirmaTecnico } from "@/components/ordenes/orden-firma"

interface ReporteServicioPrintProps {
  orden: OrdenServicio
  cliente?: Cliente
  equipo?: Equipo
  tecnico?: Tecnico
}

export function ReporteServicioPrint({ orden, cliente, equipo, tecnico }: ReporteServicioPrintProps) {
  const imprimir = () => {
    const tituloOriginal = document.title
    document.title = `ZARAMAN SERVICIOS - ${orden.folio}`
    window.print()
    window.setTimeout(() => {
      document.title = tituloOriginal
    }, 1000)
  }

  const firmaTecnico = getFirmaTecnico(orden)

  return (
    <>
      <Button variant="outline" onClick={imprimir}>
        <Printer data-icon="inline-start" />
        Reporte PDF
      </Button>

      <div className="print-report hidden">
        <div className="print-header">
          <div className="print-brand-block">
            <img src="/zaraman-logo.svg" alt="ZARAMAN S.A. de C.V." className="print-logo" />
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
                  <figcaption><strong>{evidencia.fase}</strong>{evidencia.descripcion ? ` · ${evidencia.descripcion}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="print-section print-signatures">
          <h2>Conformidad y cierre</h2>
          <div className="print-signature-grid">
            <div>
              <div className="print-signature-box">
                {orden.firmaCliente ? <img src={orden.firmaCliente} alt="Firma del cliente" /> : null}
              </div>
              <div className="print-signature-line">Firma del cliente</div>
              <div className="print-signature-meta">
                {orden.firmaFecha ? `Fecha y hora: ${formatFechaHora(orden.firmaFecha)}` : "Pendiente de firma"}
              </div>
            </div>
            <div>
              <div className="print-signature-box">
                {firmaTecnico?.firmaTecnico ? <img src={firmaTecnico.firmaTecnico} alt="Firma del técnico" /> : null}
              </div>
              <div className="print-signature-line">Firma del técnico</div>
              <div className="print-signature-meta">{firmaTecnico?.usuarioNombre ?? tecnico?.nombre ?? "Sin firma"}</div>
              <div className="print-signature-meta">
                {firmaTecnico?.firmaTecnicoFecha
                  ? `Fecha y hora: ${formatFechaHora(firmaTecnico.firmaTecnicoFecha)}`
                  : "Pendiente de firma"}
              </div>
            </div>
          </div>

          <div className="print-signature-legend">
            <strong>LEYENDA DE FIRMAS Y CIERRE</strong>
            <p>
              La firma del cliente acredita la conformidad con el servicio realizado y bloquea la orden para evitar
              modificaciones posteriores en la orden, materiales, evidencias y firma del cliente. La firma del técnico
              asignado confirma el cierre operativo del servicio. Una vez registradas ambas firmas, la orden queda
              concluida y cerrada.
            </p>
          </div>
        </section>

        <footer className="print-footer">
          <span>ZARAMAN SERVICIOS · Reporte de servicio</span>
          <span>{orden.folio}</span>
        </footer>
      </div>

      <style jsx global>{`
        .print-report { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; }
        .print-header { display:flex; justify-content:space-between; align-items:center; gap:18px; border-bottom:2px solid #111; padding-bottom:7px; }
        .print-brand-block { display:flex; align-items:center; min-width:0; }
        .print-logo { display:block; width:150px; height:auto; max-height:58px; object-fit:contain; object-position:left center; }
        .print-title-block { text-align:right; }
        .print-document-title { font-size:13px; font-weight:800; }
        .print-folio { font-size:11px; margin-top:2px; }
        .print-status-row { display:flex; gap:20px; padding:5px 0; border-bottom:1px solid #bbb; font-size:8.5px; }
        .print-section { margin-top:8px; page-break-inside:avoid; break-inside:avoid; }
        .print-section h2 { font-size:9px; text-transform:uppercase; letter-spacing:.06em; margin:0 0 4px; padding-bottom:3px; border-bottom:1px solid #bbb; }
        .print-grid { display:grid; gap:4px 14px; }
        .print-grid-2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .print-grid-4 { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .print-data-label { display:block; font-size:6.5px; text-transform:uppercase; color:#666; margin-bottom:1px; }
        .print-data-value { font-size:8px; min-height:9px; }
        .print-block { margin-bottom:5px; }
        .print-block-label { font-size:7.5px; font-weight:700; margin-bottom:1px; }
        .print-block-value { font-size:8px; line-height:1.25; white-space:pre-wrap; }
        .print-table { width:100%; border-collapse:collapse; font-size:7.5px; }
        .print-table th,.print-table td { border:1px solid #bbb; padding:3px 4px; text-align:left; vertical-align:top; }
        .print-table th { background:#f0f0f0; font-weight:700; }
        .print-muted { color:#666; font-size:7.5px; }
        .print-evidence-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
        .print-evidence-grid figure { margin:0; page-break-inside:avoid; break-inside:avoid; }
        .print-evidence-grid img { width:100%; height:92px; object-fit:cover; border:1px solid #bbb; }
        .print-evidence-grid figcaption { font-size:6.5px; margin-top:2px; }
        .print-signature-grid { display:grid; grid-template-columns:1fr 1fr; gap:35px; }
        .print-signature-box { height:48px; border-bottom:1px solid #222; display:flex; align-items:flex-end; justify-content:center; }
        .print-signature-box img { max-width:90%; max-height:44px; object-fit:contain; }
        .print-signature-line { text-align:center; font-size:7.5px; margin-top:2px; font-weight:700; }
        .print-signature-meta { text-align:center; font-size:6.5px; color:#666; margin-top:1px; }
        .print-signature-legend { margin-top:8px; padding:5px 7px; border:1px solid #bbb; background:#f7f7f7; page-break-inside:avoid; break-inside:avoid; }
        .print-signature-legend strong { display:block; font-size:7px; margin-bottom:2px; }
        .print-signature-legend p { margin:0; font-size:6.8px; line-height:1.3; }
        .print-footer { display:flex; justify-content:space-between; margin-top:8px; padding-top:4px; border-top:1px solid #bbb; font-size:6.5px; color:#666; }
        @media print {
          @page { size:A4; margin:8mm; }
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

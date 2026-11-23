"use client"

import * as React from "react"

import {
  experienciaDeContrato,
  experienciaHistorica,
  mapCurriculum,
  type CurriculumEmpresa,
  type Experiencia,
} from "@/lib/curriculum"
import { createClient } from "@/lib/supabase/client"

export interface ResumenPersonal {
  total: number
  conCedula: number
  puestos: [string, number][]
  especialidades: string[]
}

export interface DatosCurriculum {
  curriculum: CurriculumEmpresa
  experiencia: Experiencia[]
  personal: ResumenPersonal
  /** Currículum(s) subidos al expediente para leerlos con IA. */
  documentosCv: { id: string; nombre: string; fecha: string }[]
}

/** Carga el currículum de la empresa activa con su experiencia y su personal. */
export function useCurriculum(empresaId: string | undefined) {
  const [datos, setDatos] = React.useState<DatosCurriculum | null>(null)

  const recargar = React.useCallback(async () => {
    if (!empresaId) return
    const supabase = createClient()
    const [cv, contratos, docs, tecnicos, cvs] = await Promise.all([
      supabase.from("empresa_curriculum").select("*").maybeSingle(),
      supabase
        .from("contratos")
        .select("id, numero_contrato, objeto, estado, fecha_firma, vigencia_inicio, vigencia_fin, total, clientes(nombre)")
        .neq("estado", "Cancelado")
        .order("vigencia_inicio", { ascending: false, nullsFirst: false }),
      supabase.from("contrato_documentos").select("contrato_id, tipo"),
      supabase.from("tecnicos").select("rol, activo, tiene_cedula, especialidad, perfil").eq("activo", true),
      supabase
        .from("empresa_documentos")
        .select("id, nombre_archivo, created_at")
        .eq("tipo", "Currículum de la empresa")
        .order("created_at", { ascending: false }),
    ])
    const curriculum = mapCurriculum(cv.data)
    const tiposPorContrato = new Map<string, string[]>()
    for (const d of docs.data ?? []) tiposPorContrato.set(d.contrato_id, [...(tiposPorContrato.get(d.contrato_id) ?? []), d.tipo])
    const experiencia = [
      ...(contratos.data ?? []).map((c: any) =>
        experienciaDeContrato({ ...c, cliente: c.clientes?.nombre ?? "" }, tiposPorContrato.get(c.id) ?? []),
      ),
      ...curriculum.experienciaExterna.map((e) => experienciaHistorica(e)),
    ].sort((a, b) => (b.inicio || b.fin).localeCompare(a.inicio || a.fin))

    const puestos = new Map<string, number>()
    const especialidades = new Map<string, number>()
    for (const t of tecnicos.data ?? []) {
      puestos.set(t.rol || "Técnico", (puestos.get(t.rol || "Técnico") ?? 0) + 1)
      for (const e of [...(t.perfil?.especialidades ?? []), ...String(t.especialidad ?? "").split(/[,;/]/)]) {
        const k = String(e).trim()
        if (k) especialidades.set(k, (especialidades.get(k) ?? 0) + 1)
      }
    }
    setDatos({
      curriculum,
      experiencia,
      personal: {
        total: (tecnicos.data ?? []).length,
        conCedula: (tecnicos.data ?? []).filter((t) => t.tiene_cedula).length,
        puestos: [...puestos.entries()].sort((a, b) => b[1] - a[1]),
        especialidades: [...especialidades.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k),
      },
      documentosCv: (cvs.data ?? []).map((d) => ({ id: d.id, nombre: d.nombre_archivo, fecha: d.created_at })),
    })
  }, [empresaId])

  React.useEffect(() => {
    setDatos(null)
    void recargar()
  }, [recargar])

  return { datos, recargar }
}

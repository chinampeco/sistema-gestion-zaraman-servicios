"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { HojaOrdenVista } from "@/components/ordenes/hoja-orden"
import { Button } from "@/components/ui/button"

export default function HojaOrdenPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <HojaOrdenVista
      ordenId={id}
      alVolver={
        <Button variant="ghost" render={<Link href={`/ordenes/${id}`} />} nativeButton={false}>
          <ArrowLeft data-icon="inline-start" />
          Volver a la orden
        </Button>
      }
    />
  )
}

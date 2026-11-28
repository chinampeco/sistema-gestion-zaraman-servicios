// Utilidades de servidor para leer documentos con la IA (contratos y órdenes).

import Anthropic from "@anthropic-ai/sdk"
import mammoth from "mammoth"

export type Bloque = Anthropic.Beta.BetaContentBlockParam

/** Modelo con el que se leen los documentos. */
export const MODELO_LECTURA = "claude-opus-5-5"

export function tipoPorFirma(bytes: Uint8Array): "pdf" | "docx" | "jpeg" | "png" | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx"
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  return null
}

/** Toma el objeto JSON de la respuesta aunque venga entre \`\`\` o con texto alrededor. */
export function extraerJson(texto: string): string {
  const inicio = texto.indexOf("{")
  const fin = texto.lastIndexOf("}")
  return inicio >= 0 && fin > inicio ? texto.slice(inicio, fin + 1) : texto
}

/** Convierte un archivo en bloques para la IA; null si no es PDF, Word ni imagen. */
export async function bloquesDeArchivo(buffer: Buffer, titulo: string): Promise<Bloque[] | null> {
  const tipo = tipoPorFirma(buffer)
  if (tipo === "pdf") {
    return [
      {
        type: "document",
        title: titulo,
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      },
    ]
  }
  if (tipo === "docx") {
    // Word no se envía tal cual: se convierte a HTML (conserva las tablas) sin imágenes.
    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
    )
    return [
      {
        type: "document",
        title: titulo,
        source: { type: "text", media_type: "text/plain", data: html || "(documento vacío)" },
      },
    ]
  }
  if (tipo === "jpeg" || tipo === "png") {
    return [
      { type: "text", text: titulo },
      {
        type: "image",
        source: { type: "base64", media_type: tipo === "png" ? "image/png" : "image/jpeg", data: buffer.toString("base64") },
      },
    ]
  }
  return null
}

/** Mensaje de la API sin el JSON alrededor (p. ej. "Your credit balance is too low…"). */
function textoDelError(e: InstanceType<typeof Anthropic.APIError>): string {
  const cuerpo = e.error as { error?: { message?: string } } | undefined
  return cuerpo?.error?.message ?? e.message
}

/**
 * Traduce un error de la IA a un mensaje claro en español y su estado HTTP.
 * Lo usan todas las lecturas con IA (contratos, órdenes, licitaciones, documentos…).
 */
export function errorIA(e: unknown, generico = "No se pudo leer el documento; intenta de nuevo."): { mensaje: string; status: number } {
  if (!(e instanceof Anthropic.APIError)) return { mensaje: generico, status: 502 }
  const texto = textoDelError(e)
  if (/credit balance|billing|purchase credits/i.test(texto)) {
    return {
      mensaje:
        "Se terminó el saldo de la IA. Recarga créditos en console.anthropic.com (Settings → Billing) y vuelve a intentar.",
      status: 402,
    }
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return { mensaje: "La clave de la IA no es válida o no tiene permiso. Revísala en Vercel (ANTHROPIC_API_KEY).", status: 503 }
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { mensaje: "La IA está saturada en este momento. Intenta en un minuto.", status: 429 }
  }
  if (e.status === 529 || /overloaded/i.test(texto)) {
    return { mensaje: "La IA está sobrecargada en este momento. Intenta en unos minutos.", status: 503 }
  }
  if (e instanceof Anthropic.BadRequestError) {
    return { mensaje: `La IA rechazó los archivos: ${texto}`, status: 400 }
  }
  return { mensaje: `Error de la IA (${e.status ?? "sin estado"}). Intenta de nuevo.`, status: 502 }
}

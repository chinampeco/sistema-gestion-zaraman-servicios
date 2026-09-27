import Link from "next/link"
import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <TriangleAlert className="size-6" />
          </div>
          <CardTitle>Error de autenticación</CardTitle>
          <CardDescription>
            {error ?? "Ocurrió un problema al procesar tu solicitud."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Intenta iniciar sesión de nuevo.
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" nativeButton={false}>
            <Link href="/auth/login">Ir a iniciar sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

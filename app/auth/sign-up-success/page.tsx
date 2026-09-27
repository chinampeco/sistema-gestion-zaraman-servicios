import Link from "next/link"
import { MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MailCheck className="size-6" />
          </div>
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>
            Te enviamos un enlace de confirmación. Confírmalo para activar tu
            cuenta y poder iniciar sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Si no lo ves, revisa la carpeta de correo no deseado.
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full" nativeButton={false}>
            <Link href="/auth/login">Volver a iniciar sesión</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

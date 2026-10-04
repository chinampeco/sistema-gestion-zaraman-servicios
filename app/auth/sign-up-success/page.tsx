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
            Te enviamos un enlace de confirmación. Después de confirmarlo, un
            administrador debe activar tu cuenta y asignarte un rol para que
            puedas entrar al panel.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          Si no lo ves, revisa la carpeta de correo no deseado.
        </CardContent>
        <CardFooter>
          <Button className="w-full" render={<Link href="/auth/login" />} nativeButton={false}>
            Volver a iniciar sesión
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

# Migraciones del proyecto equivocado (no aplicar)

Estas 15 migraciones se escribieron para el proyecto de Supabase
`stpdxdvdvnnqthpwckxr`, que la app **no** usa. Asumen `profiles.role` con
roles en minúscula y `private.current_user_role()`, cosas que no existen en
la base de producción `ynpvetdujkpxuaplsona`.

Se sacaron de `supabase/migrations` para que `supabase db push` no intente
aplicarlas. Lo que la app necesitaba de ellas se reescribió, adaptado al
esquema real, en las migraciones `20261004191825` a `20261004192023` de
`supabase/migrations`.

Se conservan solo como referencia histórica.

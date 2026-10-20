# `@mercurio/db`

Esquema de PostgreSQL + cliente Drizzle ORM para MercurioTS. Es un port fiel del
esquema que generaba `Mercurio.Api` con EF Core + Npgsql: mismas 25 tablas
(7 de identidad ASP.NET + 18 de negocio), mismos nombres de tablas, columnas,
índices y cascadas.

## Convenciones de tipos

| Dominio TS (`@mercurio/domain`) | PostgreSQL | Conversión (`convertir.ts`) |
| --- | --- | --- |
| Minutos desde medianoche | `interval` | `aMinutos()` / `aIntervalo()` |
| Céntimos (dinero) | `numeric` | `aCentimos()` / `aNumerico()` |
| Unidades y porcentajes | `numeric` | `aNumero()` / `aTextoNumerico()` |
| Enums | `integer` | `.$type<Enum>()` en el esquema |
| Fechas `YYYY-MM-DD` | `timestamp` (mode `string`) | capa de repositorios |

## Uso

```ts
import { crearDb, conductores } from "@mercurio/db";

const db = crearDb(process.env.DATABASE_URL!);
const filas = await db.select().from(conductores);
```

## Scripts de desarrollo

- `pnpm db:generate` — regenera la migración SQL desde `src/schema.ts`.
- `pnpm db:migrate` — aplica migraciones a la BD de `DATABASE_URL`.
- `pnpm --filter @mercurio/db check` — valida que migraciones y esquema coinciden.

## BD local de desarrollo

Supón un Postgres local (el mismo del sistema anterior; no se toca su BD
`mercurio`). Credenciales en `.env.local` **gitignored**:

```
DATABASE_URL=postgresql://usuario:clave@localhost:5432/mercurio_ts
```

Crear y migrar la BD `mercurio_ts`:

```powershell
$env:DATABASE_URL = ((Get-Content .env.local).Trim()) -replace '^DATABASE_URL=',''
node packages/db/scripts/crearBaseDatos.mjs
pnpm db:migrate
node packages/db/scripts/humo.mjs   # humo: identity + cascada + interval
```

Los tests de `packages/db/tests/integracion.test.ts` solo corren si
`DATABASE_URL` está definida; el resto de tests no tocan BD.

> 🚫 Nunca subir contraseñas al repo: el `.env.local` lo excluye `.gitignore`.
> En despliegue, la cadena de conexión va como secreto del servidor/GitHub.

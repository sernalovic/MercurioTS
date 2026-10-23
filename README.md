# MercurioTS

**Mercurio** es una suite de gestión de transporte urbano desarrollada en TypeScript: un portal web para trabajadores y una aplicación de escritorio para administración, ambas sobre la misma API y las mismas reglas de cálculo.

- **Portal web y API:** Next.js 16 (`apps/web`), portal de trabajadores, zonas de administración y API `api/v1` con sesión JWT.
- **Escritorio:** Electron + React (`apps/desktop`), SPA que consume la misma API; genera PDF/Excel e instala con un setup NSIS de Windows.
- **Dominio:** paquete TypeScript puro (`packages/domain`) con las reglas de cálculo (horas, dietas, pluses, nóminas, reclamaciones), compartido por web y escritorio.
- **Base de datos:** PostgreSQL con Drizzle ORM (`packages/db`), esquema compatible con ASP.NET Identity.
- **Pruebas:** Vitest, derivadas de la especificación funcional.

## Instalar y probar

Descarga e instala (Windows x64, sin necesidad de administrador):

```
https://github.com/sernalovic/MercurioTS/releases/latest/download/Mercurio-Setup.exe
```

> El instalador **no está firmado**, así que Windows mostrará el aviso de SmartScreen al ejecutarlo.

El portal vive en producción en <https://mercurio-ts.vercel.app>. El despliegue (Vercel + Neon) está documentado en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md); las fases y arquitectura del escritorio, en [`docs/ESCRITORIO.md`](docs/ESCRITORIO.md).

## Documentación

| Documento | Contenido |
|---|---|
| [ESPECIFICACION.md](docs/especificacion/ESPECIFICACION.md) | Arquitectura, dominio, pantallas y API |
| [REGLAS-CALCULO.md](docs/especificacion/REGLAS-CALCULO.md) | Fórmulas y reglas de negocio en lenguaje natural; es la referencia de todas las reglas de cálculo, con las dudas marcadas con **[?]** |
| [catalogo-api.md](docs/especificacion/catalogo-api.md) | Endpoints de la API (las rutas de `api/v1`) |
| [pantallas-y-acciones.md](docs/especificacion/pantallas-y-acciones.md) | Acciones y textos de cada pantalla |
| [MIGRACION.md](docs/MIGRACION.md) | Cómo se cargaron los datos iniciales (usuarios, convenios, centros, líneas, calendarios…) |
| [DESPLIEGUE.md](docs/DESPLIEGUE.md) | Despliegue en producción: Vercel + Neon, datos y releases del escritorio |
| [ESCRITORIO.md](docs/ESCRITORIO.md) | Fases del escritorio (M1–M10, todas hechas) y su arquitectura |

La fuente de verdad de las reglas de cálculo es `REGLAS-CALCULO.md`; los tests del paquete de dominio derivan de ese documento.

Los datos personales (usuarios, calendarios, nóminas…) **no** se copian a este repositorio: la base de datos vive en Neon (producción) y en un Postgres local; el repo solo contiene el esquema y la lógica.

## Desarrollo

Monorepo pnpm:

```
apps/web        Portal Next.js 16 (App Router, src/, CSS plano)
apps/desktop    Aplicación Electron (electron-vite + electron-builder)
packages/domain Reglas de cálculo en TS puro, con tests Vitest
packages/db     Esquema Drizzle, migraciones y scripts de datos
```

```bash
pnpm install        # instala todos los paquetes
pnpm dev            # portal web en local
pnpm test           # tests de todos los paquetes
pnpm build          # build de todos los paquetes
pnpm dist:win       # generación del instalador Windows
```

Para el escritorio en desarrollo (ventana de Electron con HMR):

```bash
pnpm --filter @mercurio/desktop dev
```

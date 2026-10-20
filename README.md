# MercurioTS

Reconstrucción de Mercurio con un nuevo stack: Next.js + TypeScript + Electron.

- **Portal web y API:** Next.js 16 (`apps/web`; portal de trabajadores, zonas de administración y API `api/v1`).
- **Escritorio:** Electron (`apps/desktop`), con instalador NSIS de Windows vía `electron-builder` (`pnpm dist:win`).
- **Dominio:** paquete TypeScript puro (`packages/domain`) con las reglas de cálculo (horas, dietas, pluses, nóminas, reclamaciones), compartido por web y escritorio.
- **Pruebas:** Vitest, derivadas de la especificación, igual que los tests xUnit del original.
- **Base de datos:** PostgreSQL, con ORM por decidir en el paso de la API (Drizzle u otros).

## Documentación

El análisis funcional del sistema original vive aquí, en `docs/analisis-sistema-anterior`:

| Documento | Contenido |
|---|---|
| [ESPECIFICACION.md](docs/analisis-sistema-anterior/ESPECIFICACION.md) | Arquitectura, dominio, pantallas y API del original |
| [REGLAS-CALCULO.md](docs/analisis-sistema-anterior/REGLAS-CALCULO.md) | Fórmulas y reglas de negocio en lenguaje natural; es la referencia de todas las reglas de cálculo, con las dudas marcadas con **[?]** |
| [catalogo-api.md](docs/analisis-sistema-anterior/catalogo-api.md) | Endpoints del original (se conservan las mismas rutas) |
| [pantallas-y-acciones.md](docs/analisis-sistema-anterior/pantallas-y-acciones.md) | Acciones y textos de cada pantalla |
| [MIGRACION.md](docs/MIGRACION.md) | Cómo se exportaron e importaron los datos del original (útil para la futura migración de datos a la nueva base) |

La fuente de verdad de las reglas de cálculo es `REGLAS-CALCULO.md`. Los tests del paquete de dominio derivarán de este documento, igual que los tests xUnit originales.

Los datos personales exportados del sistema original **no** se copian a este repositorio: permanecen solo en local, junto al proyecto .NET.

## Estado

Monorepo pnpm montado y funcional:

```
apps/web        Next.js 16 (App Router, src/, CSS plano sin Tailwind, sin ESLint adicional)
apps/desktop    Electron 44 + electron-builder (instalador Windows NSIS; sin UI real todavía)
packages/domain Reglas de cálculo en TS puro; primero Horas.Duracion, con tests Vitest
```

- `pnpm test` ejecuta los tests de todos los paquetes.
- `pnpm dev` arranca la web.
- `pnpm dist:win` genera el instalador Windows (aún no probado con una UI real).

Por decidir: ORM de la base de datos, y librerías de PDF/Excel para el port.

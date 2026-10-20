# MercurioTS

Reconstrucción de Mercurio con un nuevo stack: Next.js + TypeScript.

- **Portal web y API:** Next.js (portal de trabajadores, zonas de administración y API `api/v1`).
- **Escritorio:** Tauri con UI React, instalable en Windows.
- **Dominio:** paquete TypeScript puro con las reglas de cálculo (horas, dietas, pluses, nóminas, reclamaciones), compartido por web y escritorio.
- **Base de datos:** PostgreSQL, vía Drizzle.

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

Estructura inicial del monorepo. Por decidir: Tauri vs Electron, y Prisma vs Drizzle.

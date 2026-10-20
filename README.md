# MercurioTS

Reconstrucción de Mercurio con un nuevo stack: Next.js + TypeScript.

- **Portal web y API:** Next.js (portal de trabajadores, zonas de administración y API `api/v1`).
- **Escritorio:** Tauri con UI React, instalable en Windows.
- **Dominio:** paquete TypeScript puro con las reglas de cálculo (horas, dietas, pluses, nóminas, reclamaciones), compartido por web y escritorio.
- **Base de datos:** PostgreSQL, vía Drizzle.

El análisis funcional del sistema original y la especificación de reglas siguen viviendo en el repositorio .NET original (`Mercurio`), junto a los tests xUnit que servían de referencia. La fuente de verdad de las reglas de cálculo es `docs/analisis-sistema-anterior/REGLAS-CALCULO.md` en ese repo.

## Estado

Estructura inicial del monorepo. Por decidir: Tauri vs Electron, y Prisma vs Drizzle.

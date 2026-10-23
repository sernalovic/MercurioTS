# Despliegue del portal (Vercel + Neon)

Estado actual de la web `apps/web` en producción.

## Configuración

| Pieza | Valor |
|---|---|
| Web | <https://mercurio-ts.vercel.app> |
| Repositorio | este repo, rama `main` → despliegue automático |
| Base de datos | Neon, proyecto `Mercurio` (región eu-west-2), cadena **pooled** |
| Variables de entorno de Vercel | `DATABASE_URL` (cadena pooled de Neon), `MERCURIO_SECRETO` (frase aleatoria para firmar la sesión) |

La cadena pooled (host `…-pooler…`) es la que Vercel debe usar: abre conexiones nuevas en cada petición y soporta muchos conectores simultáneos.

## Migración de datos reales a Neon (21/10/2026)

1. **Esquema:** `pnpm --filter @mercurio/db exec drizzle-kit push --force` con
   `DATABASE_URL` de Neon.
2. **Datos:** `packages/db/scripts/copiarProduccion.ts` copió la BD local
   `mercurio` (solo lectura) → Neon, tabla a tabla con los mismos ids en orden
   de dependencias, en tandas de ≤300 filas, y ajustó las secuencias al final.
   Un primer intento dejó tablas a medias (la primera página de la paginación
   por Id iba sin `ORDER BY`); corregido y recopiadas.

Recuentos finales, idénticos origen/destino: 65 usuarios, 6 convenios, 30
opciones de centro, 18 tablas salariales, 300 festivos, 32 líneas, 214
itinerarios, 871 paradas, 9.511 gráficos, 471 itinerarios-gráficos, 303
conductores, 5 regulaciones, 10 nóminas, 100 conceptos de nómina, 7.271
calendarios, 221.222 días de calendario, 7.271 resúmenes, 43 reclamaciones y
151 conceptos reclamados.

Para repetir (p. ej. recuperación), con cadenas de origen y destino en el
entorno `MERCURIO_ORIGEN` y `MERCURIO_DESTINO`:

```bash
node --experimental-transform-types packages/db/scripts/copiarProduccion.ts ver    # recuentos
node --experimental-transform-types packages/db/scripts/copiarProduccion.ts        # copia incremental
node --experimental-transform-types packages/db/scripts/copiarProduccion.ts fuerza # trunca el destino y recopia
```

La copia nunca escribe en la BD de origen.

## Usuarios y contraseñas

De los 65 usuarios importados, 64 llegaron sin contraseña (el original no
exporta claves; solo `1971josean@gmail.com`, súper-administrador, conservó su
hash). Hay 4 usuarios con `IsAdmin`: ids 8, 9, 10 y 65.

El portal verifica hashes v3 de ASP.NET Identity, así que las claves del
sistema anterior siguen siendo válidas. Para dar (o restablecer) una clave sin
SMTP:

```bash
$env:DATABASE_URL = 'cadena de Neon'   # o la de la BD local
node --experimental-transform-types packages/db/scripts/fijarClave.ts usuario "Clave"
```

## Programa de escritorio (releases de GitHub)

El repo es **público** y el portal enlaza la descarga desde
`/portal/administracion/software` a la última release:

```
https://github.com/sernalovic/MercurioTS/releases/latest/download/Mercurio-Setup.exe
```

Esa URL exige que el asset se llame **`Mercurio-Setup.exe`** (sin versión, ya
fijado en `electron-builder.yml`), así cada release nueva sustituye al
anterior sin tocar la web. Para publicar una versión:

```bash
pnpm -C apps/desktop empaquetar          # → apps/desktop/release/Mercurio-Setup.exe
gh release create v0.2.0 apps/desktop/release/Mercurio-Setup.exe \
  --title "Mercurio 0.2.0" --notes "Cambios de la versión"
```

(Sin `gh`, la release se crea a mano en la web de GitHub subiendo el `.exe`
con ese nombre exacto.)

## Pendiente

- Firma de código del instalador (certificate de Windows) para quitar el aviso
  de SmartScreen.

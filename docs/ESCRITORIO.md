# Migración del escritorio (Electron)

Reconstrucción de `Mercurio.Desktop` (WPF .NET 8, MVVM) en `apps/desktop`.
La app es una SPA React + TypeScript con CSS plano, empaquetada con
electron + electron-vite.

## Arquitectura decidida (22/10/2026)

- **Datos por HTTP contra la web de Vercel**: la web expone `POST/GET
  /api/v1/…` (route handlers de `apps/web`) con token Bearer JWT — el
  mismo formato de sesión (`MERCURIO_SECRETO`, 14 días) que la cookie
  del portal. Equivale a cómo el original hablaba con `Mercurio.Api`:
  sin credenciales de BD en ningún PC y lógica/BD en un solo sitio.
- **Cálculo del dominio compartido**: las reglas ya portadas viven en
  `packages/domain` y `apps/web/src/lib`; las que usa el escritorio en
  el render (recalcular calendarios) se extraerán a packages/domain
  para que web y escritorio calculen igual.
- **Configuración** en userData de Electron (`config.json`): `Servidor`
  (por defecto <https://mercurio-ts.vercel.app>), `UsuarioUltimo`,
  `UltimoCentro`, token y su expiración. Igual sitio que usaba el
  original (`%APPDATA%\Mercurio\config.json`).
- **Sin SignalR por ahora**: en el original el aviso en tiempo real
  (`calendariosHub´) lo emitía el servidor; el portal TS no tiene hub.
  Se valorará más adelante (SSE o sondeo).
- **PDF/Excel en el propio escritorio** (jsPDF/pdfmake + xlsx), tal y
  como el original generaba QuestPDF/ClosedXML en local.

## Fases

| # | Contenido | Estado |
|---|---|---|
| M1 | Esqueleto Electron (ventana, config, preload), login, shell con centro/mes, menú de tiles, API `cuenta/entrar` + `cuenta/verificar` + CORS | **hecha** |
| M2 | Pantalla Conductores: rejilla de conductores + regulaciones, CRUD, guardado en lote | **hecha** |
| M3 | Rejillas de Calendarios (mensual y por conductor, 3 vistas), borrar, **operaciones del mes** y **pegado desde Excel** (parse y siembra en el servidor, regenerado final) | **hecha** |
| M4 | Pantalla Gráficos: grupos por validez, gráficos con itinerarios, recalcular/deducir día/turno en el cliente con `CalculosHorario`, guardar en lote (`graficos`, `graficos/porFecha`, `itinerariosGraficos`, `convenios`). Los botones Importar/Exportar JSON del original no tenían comando en el ViewModel y no se portan | **hecha** |
| M5 | Detalle de calendario: editor con recálculo en vivo, saldos, generar reclamación/nómina | pendiente |
| M6 | Reclamaciones (PDF) y Nóminas | pendiente |
| M7 | Convenios (3 pestañas) y Líneas/Itinerarios/Paradas | pendiente |
| M8 | Informes, Herramientas (Excel crudo), Extraer gráficos, Usuarios (súper), correo masivo | pendiente |
| M9 | Empaquetado con electron-builder (NSIS) + icono, firma y despliegue desde GitHub Releases | pendiente |

## Cómo arrancar (desarrollo)

```bash
pnpm install
pnpm --filter @mercurio/desktop dev      # ventana de Electron con HMR
```

Sin Electron también se puede desarrollar el renderer en el navegador:
la SPA detecta que no hay puente (`window.mercurio`) y guarda la
configuración en `localStorage`.

## Referencias del original

- `C:\Users\Jorge\Desktop\PROYECTOS\Mercurio\src\Mercurio.Desktop` — fuente WPF.
- `docs/analisis-sistema-anterior/pantallas-y-acciones.md` — catálogo de pantallas.
- `docs/analisis-sistema-anterior/REGLAS-CALCULO.md` — reglas del dominio.
- `docs/analisis-sistema-anterior/catalogo-api.md` — endpoints que consumía.

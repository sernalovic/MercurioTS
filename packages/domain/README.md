# @mercurio/domain

Port de `Mercurio.Domain` (C#) a TypeScript puro: entidades y reglas de cálculo
(horas, dietas, pluses, resúmenes, nóminas y reclamaciones), compartidos por la
web y el escritorio.

La fuente de verdad es [`docs/analisis-sistema-anterior/REGLAS-CALCULO.md`](../../docs/analisis-sistema-anterior/REGLAS-CALCULO.md).
Los tests derivan de ese documento, igual que los tests xUnit del proyecto original.

## Convenciones del port

- Las horas del día van en **minutos desde medianoche** (0–1439), no hay `TimeSpan`.
  Un servicio que empieza a las 22:00 es `1320`.
- Los importes van en **céntimos enteros** (`number`), nunca en coma flotante.
- Los días son fechas sin zona horaria (cadenas `YYYY-MM-DD`).

## Estado

Port empezado:

- `Horas` (Utilidades.cs): `Duracion`, `EnHoras`, `Max`, `ParseDecimal`.
- `Enums.cs` completo, con los mismos valores numéricos que el original.
- `RangoNumeros` ("1-50, 60, 70..80").
- Entidades mínimas para el cálculo (`Servicio`, `Grafico`, `Convenio`, `OpcionesCentro`, `Festivo`, `DiaCalendario`).
- `Incidencias.EsTrabajo`.
- `CalculosHorario` completo: duraciones, dietas, recálculo de servicio y gráfico
  (incluido el error de tiempo partido, recalculado en cada pasada), tipo de día
  por rangos, festivos, plus por menor descanso, regenerar día y cambio de propiedad.

Pendiente del port: `CalculosCalendario`, `CalculosNomina`, `CalculosReclamacion`,
resto de `Incidencias` (descansos, variantes JD/FN, parseo y texto de celdas) y
`ExtraccionGraficos`/`ComparacionGraficos`.

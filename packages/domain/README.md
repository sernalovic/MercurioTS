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
- `Incidencias` completo: trabajo/descansos (incl. variantes JD/FN), formación,
  asignar sobre descanso, parseo y texto de celdas de calendario.
- `Fechas`: fechas `YYYY-MM-DD` sin zona horaria; día de la semana vía UTC.
- Entidades de calendario: `Calendario`, `ResumenCalendario` (+ totalizadores),
  `DiaCalendario`, `Conductor`, `TablaSalarial`.
- `CalculosCalendario`: crear días, ajustar JDs (variantes fin de semana y
  descansos sueltos), diferencias en contra, importes mensuales, y el resumen
  mensual completo (12.1 contadores, 12.2 validaciones y errores, 12.3 importes).
- Entidades de nómina: `Nomina`, `ConceptoNomina`; de reclamación: `Reclamacion`,
  `ConceptoReclamado`; y `Regulacion` + saldos iniciales en `Conductor`.
- `CalculosNomina`: tramos de antigüedad, texto del complemento por categoría,
  `generarNomina` (nómina mensual del calendario), `recalcularNomina` de bases y
  descuentos, e `incrementarImportes` de convenios (secciones 10 y 11).
- `CalculosReclamacion`: saldos de acumuladas/DCs/DNDs/vacaciones pendientes
  (sección 15), `conceptoPorIncidencia`, `generarReclamacion` y las notas con
  totales en formato es-ES (secciones 9, 13 y 14).

Pendiente del port: `ExtraccionGraficos` y `ComparacionGraficos` (usa el
importador de gráficos y las herramientas de comparación).

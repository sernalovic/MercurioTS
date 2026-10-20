# Comparación con los datos reales del sistema anterior (20/10/2026)

**Exportación:** 303 conductores, 9.511 gráficos, 7.327 calendarios (222.934 días) desde 2021, 43 reclamaciones, 10 nóminas y 65 usuarios. El informe completo está en `exportacion-sistema-anterior/comparacion.md` y `comparacion.csv`; esa carpeta contiene datos personales y no va al repositorio.

| Ámbito | Revisados | Coinciden en bruto |
|---|---:|---:|
| Servicios diarios (trabajado y virtual) | 445.868 | 99,2 % |
| Gráficos | 9.509 | 96,2 % |
| Resúmenes mensuales | 7.327 | 35 % |

## Conclusión
**No se ha encontrado ninguna regla de Mercurio que reproduzca mal la del original.** Cada grupo de diferencias se ha seguido hasta su causa en los datos.

| Causa | Afecta a | Cómo se ha comprobado |
|---|---|---|
| **Resúmenes desfasados:** se editaron los días después de calcular el resumen y no se recalculó | 211 resúmenes | Sus contadores no cuadran con sus propios días (p. ej. 0 días LACJD guardados con 10 en el mes) |
| **Subida de importes de 2023 sin recalcular** | ~2.200 resúmenes de 2023 y 2.199 servicios (paquetería 7,87 → 8,47) | Proporción constante ×0,929 en todos los importes (sábados, festivos, dietas, nocturnidad, limpieza, quebranto) |
| **Versión antigua del sistema anterior (2021-2022)**, que no calculaba dietas, nocturnidad parcial, limpiezas ni quebranto | Resúmenes de 2021-2022 | Esos campos están a 0 en todo el periodo |
| **Cambio de situación del conductor:** dos conductores eran eventuales y hoy son fijos | Todas las diferencias de 2024 en adelante en días que debería trabajar, descansar o tener de vacaciones, variable de vacaciones y limpiezas | El original calculó con la situación de entonces |
| **Servicio virtual introducido a mano** (lo que pagó la empresa) | ~2.000 servicios virtuales, concentrados en pocas matrículas | Valores tecleados como 0,33 o 1,04 |
| **Grupos de gráficos que nunca se recalcularon** en el original, y días que copiaron esos ceros | 315 gráficos y ~140 servicios | Tiempo total y trabajadas a 0 con horario informado |
| **Fallo del original: aviso de error de partido** que solo se activaba y nunca se desactivaba | 47 gráficos | Mercurio lo recalcula siempre (decisión documentada en el README) |
| **Fallo del original: plus por menor descanso** calculado contra el último día del mes anterior en vez de contra el día anterior real | ~310 días | La hora de fin implícita en el importe coincide exactamente con la del último día del mes anterior (p. ej. 21:30 para un conductor en todo agosto de 2022 y 23:40 para otro en enero de 2024) |
| **Datos anómalos** | Unos pocos calendarios | Fechas del año 7 y de 1847, y calendarios de un conductor que ya no existe (id 7) |

## Decisiones pendientes para el usuario
1. **Plus por menor descanso:** Mercurio lo calcula contra el día anterior real, como dice la regla. El original pagó de más en algunos meses. ¿Se mantiene la regla correcta? (Recomendado: sí.)
2. **Resúmenes históricos:** al importar se conservan tal como estaban, desfasados o con precios antiguos, para no alterar la historia. Se pueden recalcular por meses con "Recalcular resúmenes" cuando se quiera.
3. **Datos anómalos:** revisarlos y borrarlos en Mercurio después de importar.

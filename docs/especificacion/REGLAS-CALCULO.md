# Mercurio: reglas de cálculo

> **Procedencia.** Reglas extraídas del IL de `Orion2.Shared.dll` y `Nelya.Core.dll` (el sistema
> sobre el que se trabajó) con un desensamblador propio que lee los cuerpos de método a partir de
> los offsets que da REA. Se reescriben en lenguaje natural para reimplementarlas sin copiar código.
> Convención: una hora "vacía" (sin valor) se representa en el original con `TimeSpan.MaxValue`. En
> Mercurio será `null`.
> `Horas(t)` = t en horas decimales, redondeadas a 6 decimales.

## 0. Utilidades
- **Rangos de números** (OpcionesCentro.NumerosL, V, S, F y R): texto con elementos separados por comas. Se ignoran los espacios. Cada elemento es `n` o `a-b`; `a..b` equivale a `a-b`. Los rangos incluyen sus extremos. Se descarta un elemento cuyo inicio y fin sean 0.
- **Texto a decimal**: `,` se convierte en `.`, se quita `€` y se interpreta con cultura invariante. Si no se puede, vale 0.
- **Turno** (entero): 0 sin turno, 1 mañana, 2 tarde, 3 noche, 4 partido. Solo se calculan los turnos del 1 al 4.

## 1. Cálculo de un servicio o de un gráfico
Entradas: Inicio, Final, InicioPartido, FinalPartido, Turno y TienePlusPaqueteria o FacturadoPaqueteria. Se usa el convenio vigente.

**Salida anticipada**: si `NoCalcular` está activo no se toca nada.
- *Servicio*: si el turno no está entre 1 y 4, o falta Inicio o Final, se ponen a cero TiempoTotal, TiempoPartido, Trabajadas, TrabajadasConvenio, Acumuladas, Nocturnas, Desayuno, Comida, Cena y PlusPaqueteria.
- *Gráfico*: en ese mismo caso simplemente no se recalcula.

**Paquetería (solo servicios)**: si TienePlusPaqueteria, PlusPaqueteria = convenio.ImportePlusPaqueteria. Si no, PlusPaqueteria = FacturadoPaqueteria × 0,10.

**Duraciones**:
- `Duracion(a, b)` = b − a; si es negativa se suman 24 h. Si falta a o b, vale 0.
- TiempoTotal = Duracion(Inicio, Final).
- TiempoPartido = Duracion(InicioPartido, FinalPartido).
- **Trabajadas** = TiempoTotal − TiempoPartido + exceso, donde exceso = max(0, TiempoPartido − convenio.TiempoPartidoMaximo). Es decir, la parte de la partición que supera el máximo cuenta como trabajada. Sin convenio vale 0.
- **TrabajadasConvenio** = max(Trabajadas, convenio.JornadaMedia).
- **Acumuladas** = max(0, Trabajadas − JornadaMedia).

**Nocturnas** (solo turnos 1, 2 y 4; en turno 3 vale 0, véase la nota):
- Si Final < Inicio, a Final se le suman 24 h.
- Si Inicio < FinalNocturnas, nocturnas = FinalNocturnas − Inicio.
- Si Final > InicioNocturnas, nocturnas = Final − InicioNocturnas. Esta asignación sobrescribe la anterior; no se suman.
- Nota: con el turno 3 (noche) el original devuelve 0 y no calcula nada. Es su comportamiento, aunque resulte llamativo. Hay que confirmarlo con el usuario.

**Desayuno** (turnos 1 a 4): solo cuenta con turno = 1 (mañana) y con Inicio informado. Si Inicio < LimiteDesayuno, desayuno = Horas(LimiteDesayuno − Inicio). Es una fracción de dieta proporcional. Si no, 0.

**Comida** (turnos 1 a 4, nunca en el 3): ComidaCompleta + ComidaParcial. En el turno 4 (partido) ambas se calculan con InicioPartido y FinalPartido; en los demás, con Inicio y Final.
- *ComidaCompleta* (sea C0 = InicioComidaContinuo y C1 = FinalComidaContinuo):
  - turno 1 y fin > C1 → 1;
  - turno 2, inicio con más de 180 minutos (más tarde de las 3:00) e inicio < C0 → 1;
  - turno < 3, fin > C1 e inicio < C0 → se suma 1 a lo anterior. Puede llegar a 2;
  - turno 4: si el tiempo de la partición que cae dentro de la ventana de comida partida es menor de 60 minutos → 1 (se sustituye el valor).
- *ComidaParcial*:
  - turno 2: si inicio = C0 → 0,5. Si inicio está entre C0+5 min y C0+30 min (sin incluir el límite superior) → Horas((C0 + 30 min) − inicio) / 2;
  - turno 4, sea P = minutos de la partición dentro de la ventana [InicioComidaPartido, FinalComidaPartido): si 60 ≤ P < 120 → Horas(120 min − P); si 0 < P < 60 → Horas(60 min − P).
- *Tiempo de partición dentro de la ventana de comida*: se cuenta minuto a minuto desde InicioPartido hasta FinalPartido (si el final es menor que el inicio, se le suman 24 h) cuántos minutos caen en [InicioComidaPartido, FinalComidaPartido).

**Cena** (turnos 1 a 4, nunca en el 3, con Inicio y Final informados). Sean I = InicioCena y F = FinalCena; si F < I, a F se le suman 24 h. Si Final < Inicio, a Final se le suman 24 h.
- Si I < Final < F → Horas(Final − I).
- Si Final ≥ F → 1.

**PlusCena** (mismas condiciones). Sea L = LimitePlusCena; si L está por debajo de las 6:00, se le suman 24 h. Si Final < Inicio, a Final se le suman 24 h. PlusCena = Horas(max(0, Final − L)) × PorcentajePlusCena / 100.
- En un **servicio**, Cena = Cena + PlusCena en un único campo.
- En un **gráfico** se guardan por separado: Cena y PlusCena.

**Errores del gráfico**: TieneErrorTiempoPartido se activa si TiempoPartido > TiempoPartidoMaximo o si TiempoTotal > JornadaMaximaPartida.

## 2. Tipo de día de un gráfico
Se buscan las OpcionesCentro del centro en el convenio y se mira en qué rango cae el número del gráfico, en este orden: L → Lunes_Jueves, V → Viernes, S → Sábado, F → Festivo, R → Reserva. Si no cae en ninguno, Ninguno.

## 3. Festivos
- EsFestivo(fecha, centro): el centro tiene que ser distinto de "Todos" y la fecha tiene que figurar exactamente entre los festivos de las OpcionesCentro de ese centro.
- FestivosEnMes: número de festivos del centro en ese año y mes.
- Hay14Festivos: el centro tiene al menos 14 festivos.

## 4. Plus por menor descanso
Se calcula entre el servicio de un día (S), el del día anterior (A) y el del día siguiente (P).
1. S.PlusMenorDescanso empieza en 0. Si A tiene Final y S tiene Inicio:
   - se calcula IA = S.Inicio + 24 h;
   - si S es de turno noche (3) y la hora de IA es anterior a las 3:00, se suman otras 24 h;
   - si IA < A.Final, se suman 24 h;
   - descanso = Horas(IA − A.Final) y, si descanso < 12, S.PlusMenorDescanso = (12 − descanso) × convenio.ImportePlusMenorDescanso.
2. Si existe P: se aplica el mismo cálculo entre S.Final y P.Inicio y se guarda en P.PlusMenorDescanso (0 si no hay datos).

## 5. Regenerar un día (a partir del calendario anual o del gráfico)
Parámetros: el día, el día anterior, el día siguiente y el gráfico correspondiente al número trabajado.
1. Si el servicio trabajado es de trabajo (véase EsTrabajo):
   - **sin gráfico**: el servicio trabajado pasa a ser uno nuevo que solo conserva Id, DiaCalendarioId, Incidencia, Codigo y Numero, con Trabajadas = TrabajadasConvenio = JornadaMedia;
   - **con gráfico**: se ponen a 0 Limpieza, PlusPaqueteria, FacturadoPaqueteria y PlusMenorDescanso; se copian todos los campos del gráfico al servicio trabajado conservando Id y DiaCalendarioId; y la paquetería se recalcula como en 1.
2. El servicio virtual pasa a ser una copia del trabajado (conservando su propio Id y DiaCalendarioId).
3. Se recalcula el plus por menor descanso (4) del trabajado con los trabajados del día anterior y del siguiente, y lo mismo para el virtual.

## 6. Incidencias

### 6.1 Valores
0 Inactivo · 1 Trabajo · 2 TrabajoJD · 3 TrabajoFN · 4 JD · 5 FN · 6 DS · 7 DND · 8 DC · 9 F6 · 10 F6DC · 11 PER · 12 OV · 13 OVJD · 14 OVFN · 15 E · 16 EJD · 17 EFN · 18 FOR · 19 FORJD · 20 FORFN · 21 OVA · 22 OVAJD · 23 OVAFN · 24 LAC · 25 LACJD · 26 LACFN · 27 RE · 28 DF · 29 F6D.

### 6.2 Clasificación
- **EsTrabajo(inc, número)**: Trabajo, TrabajoJD, TrabajoFN y FOR siempre; RE solo si número > 0.
- **EsDescanso**: TrabajoJD, TrabajoFN, JD, FN, DS, OVJD, OVFN, EJD, EFN, FORJD, FORFN, OVAJD, OVAFN, LACJD y LACFN. Son los días que **caen en descanso**, aunque se trabajen.
- **EsDescansoJD**: JD, DS, OVJD, EJD, FORJD, OVAJD y LACJD. TrabajoJD **no** cuenta.
- **EsDescansoFN**: FN, OVFN, EFN, FORFN, OVAFN y LACFN.
- **EsFormacion**: FOR, FORJD y FORFN.

### 6.3 Conversiones
- **AsignarIncidencia(actual, nueva)**: si la nueva es Trabajo, E, OV, OVA, LAC o FOR y el día actual es descanso JD, se usa la variante JD (TrabajoJD, EJD, OVJD…). Si es descanso FN, la variante FN. En cualquier otro caso, la nueva tal cual.
- **Texto a incidencia** (ParseIncidencia). Primero se quitan `*`, `>` y los espacios. Si lo que queda es un número n, el resultado es (Trabajo, n). Si no, se pasa a minúsculas, se quitan los `-` y se busca en esta tabla:
  - `i`, `in`, `inac`, `inactivo` → Inactivo
  - `t`, `l`, `tra`, `trab`, `trabajo` → Trabajo
  - `tjd`, `trajd`, `trabjd`, `trabajojd` → TrabajoJD
  - `tfn`, `trafn`, `trabfn`, `trabajofn` → TrabajoFN
  - `jd` → JD · `fn` → FN · `ds` → DS · `dc` y `oh` → DC · `dnd` → DND · `f6` → F6 · `f6d` → F6D · `f6dc` → F6DC · `df` → DF · `per` → PER
  - `e` y `ge` → E · `ejd` → EJD · `efn` → EFN
  - `ov` → OV · `ovjd` → OVJD · `ovfn` → OVFN · `ova` → OVA · `ovajd` → OVAJD · `ovafn` → OVAFN
  - `for` → FOR · `forjd` → FORJD · `forfn` → FORFN
  - `lac` → LAC · `lacjd` → LACJD · `lacfn` → LACFN
  - `re`, `rj`, `rjor`, `rej` → RE
  - Cualquier otro texto → Inactivo.
- **Incidencia a texto** (ParseServicio): si es Trabajo, TrabajoJD o TrabajoFN, o RE con número > 0, se muestra el número; si no, el nombre de la incidencia (vacío si es Inactivo). Se añade `*` cuando el código es distinto de Ninguno o la incidencia es TrabajoJD o TrabajoFN. Se añade otro `*` cuando es RE con número.
- **Abreviatura**: Trabajo → "Trab", TrabajoJD → "Trab-JD", TrabajoFN → "Trab-FN". El resto, por su nombre.
- **Tipo de día por fecha** (InferirTipoDia): domingo → Festivo, sábado → Sábado, viernes → Viernes, resto → Lunes_Jueves.

### 6.4 Cambio de una propiedad en un servicio
- Si cambia Inicio, Final, Turno, InicioPartido, FinalPartido, TienePlusPaqueteria o FacturadoPaqueteria, se recalcula el servicio (1).
- Si cambia **Incidencia** a algo que no es trabajo, o a FOR, el servicio se vacía conservando solo Id, DiaCalendarioId, Incidencia y Codigo.
- Si cambia **Numero**:
  - si es ≤ 0, el servicio se vacía conservando Id, DiaCalendarioId, Incidencia y Codigo;
  - si es > 0 y la incidencia no era de trabajo, pasa a ser Trabajo;
  - después, con un número > 0, se aplica lo mismo que en 5.1: sin gráfico se pone la jornada media; con gráfico se copian sus datos y se recalcula la paquetería.

## 7. Ajustar JDs de un mes
Recibe los días del mes, el último día del mes anterior y el primer día del mes siguiente. Ambos pueden faltar; un día que falta cuenta como descanso.
Para cada día que no sea el 1 ni el último (y cuyo año no sea 9999):
1. Si es DS, pasa a JD.
2. **Sábado o domingo**: cada variante JD pasa a su variante FN. Esto incluye JD→FN, TrabajoJD→TrabajoFN, EJD→EFN, FORJD→FORFN, LACJD→LACFN, OVAJD→OVAFN y OVJD→OVFN. **Entre semana** se hace lo contrario (FN→JD, etc.).
3. Si el día es JD, FN o DS y **ni el día anterior ni el siguiente** son descanso, pasa a **DS** (descanso suelto).

El día 1 y el último día se tratan aparte, con la misma lógica: en fin de semana JD y DS pasan a FN; entre semana FN y DS pasan a JD. En ambos se aplica también el paso 3, usando como vecinos el último día del mes anterior y el primero del siguiente.

## 8. Diferencias "en contra" del trabajador
Interpretación **[I]**: Trabajado = lo que se trabajó realmente; Virtual = lo que la empresa computó o pagó. Los `Total*` del calendario son lo que aparece en la nómina.
- **Diferencias por día**: se suma (Trabajado − Virtual) en los días en que Trabajado > Virtual. Se aplica a Acumuladas, Nocturnas (como duración), Desayuno, Comida, Cena, PlusPaqueteria y PlusMenorDescanso (decimales, redondeados a 2).
- **Diferencias de importes mensuales**: Resumen.ImporteX − Calendario.TotalImporteX cuando es positivo (redondeado a 2). Se aplica a los pluses de sábados, festivos, nocturnidad, nocturnidad parcial, limpieza, Navidad y viaje, al quebranto de moneda y a los refuerzos.
  - DNDs cobrados: (ImporteDndsCobrados + ImporteDndsCobradosPorDescanso) − TotalImporteDndsCobrados.
- **TieneDiferenciasEnContra**: alguna de las diferencias anteriores es mayor que 0.
- **RestablecerImportesEnNomina**: copia los importes del resumen a los `Total*` del calendario (sábados, festivos, nocturnidad, nocturnidad parcial, paquetería, limpieza, menor descanso, Navidad, viaje, quebranto, refuerzos, dietas y DNDs cobrados).
- **Crear los días de un mes** (AddDiasToCalendario): un día por cada fecha del mes, cada uno con sus tres servicios vacíos; un resumen nuevo con DiasInactivo igual al número de días del mes.

## 9. Conceptos de reclamación por incidencia
Recibe la incidencia real del día y la que debería tener (anual o virtual):
- debería ser E y la real no es E, EJD ni EFN → concepto **Enfermo**: "La situación no es E, sino que es {real}";
- debería ser un descanso y la real es trabajo (con número 0) o PER → concepto **Descanso**: "La situación no es {esperada}, sino que es {real}";
- debería ser DC y la real no es DC ni F6DC → **DC**;
- debería ser DND y la real no es DND → **DND**;
- debería ser F6 y la real no es F6 ni F6DC → **F6**;
- debería ser F6D y la real no es F6, F6D ni F6DC → **F6** (texto "F6-D");
- en cualquier otro caso no hay concepto.

## 10. Nómina
### 10.1 Porcentaje de antigüedad
Días entre FechaAntiguedad y la fecha de la nómina:

| Días | Porcentaje |
|---|---|
| más de 730 | 5 % |
| más de 1.460 | 10 % |
| más de 3.285 | 20 % |
| más de 5.110 | 30 % |
| más de 6.935 | 40 % |
| más de 8.760 | 50 % |
| más de 10.585 | 60 % |

Se devuelve como fracción (0,05, 0,10…).

### 10.2 Generar la nómina de un calendario mensual
Necesita el conductor, el resumen, la tabla salarial de la categoría del conductor y las OpcionesCentro de su centro. Si falta algo, la nómina queda vacía.
- antigüedadDiaria = TablaSalarial.BaseAntiguedad / 30 × %antigüedad;
- díasQuebranto = DiasTrabajo + DiasTrabajoJD + DiasTrabajoFN + DiasDC;
- cabecera: ConductorId; Fecha y FechaInicio = la fecha del calendario; FechaFinal = fin de ese mes; FechaAntiguedad; % Seguridad Social y % desempleo (de la tabla); % IRPF (del conductor).

Conceptos, en este orden (Unidades × ImporteBase = Devengado). Todos computan para IRPF salvo el último.

| # | Concepto | Cuándo | Unidades | Importe base | Devengado |
|---|---|---|---|---|---|
| 1 | Salario base | Siempre | 30 | SueldoBaseMensual/30 | |
| 2 | Antigüedad | antigüedadDiaria > 0 | 30 | antigüedadDiaria | |
| 3 | Complemento salarial | ComplementoSalarial > 0 | 30 | ComplementoSalarial/30 | |
| 4 | Quebranto de moneda | díasQuebranto > 0 | díasQuebranto | PrecioQuebrantoMoneda | |
| 5 | Plus viaje | OpcionesCentro.PagarPlusViaje y ImportePlusViaje > 0 | díasQuebranto | ImportePlusViaje | |
| 6 | Plus de sábados | SabadosTrabajados > 0 | SabadosTrabajados | convenio.ImportePlusSabados | |
| 7 | Plus de festivos | Resumen.ImportePlusFestivos > 0 | FestivosTrabajados + DomingosTrabajados | convenio.ImportePlusFestivos | Resumen.ImportePlusFestivos |
| 8 | Dietas | TotalDietas > 0 | TotalDietas | convenio.ImporteDietas | |
| 9 | Plus nocturnidad | DiasTurno3 > 0 | DiasTurno3 | ImportePlusNocturnidad | |
| 10 | Plus nocturnidad parcial | HorasNocturnas > 0 | Horas(HorasNocturnas) | ImportePlusNocturnidadDiario | |
| 11 | Paquetería | Resumen.ImportePlusPaqueteria > 0 | 1 | ese importe | |
| 12 | Plus limpieza | TotalLimpiezas > 0 | TotalLimpiezas | ImportePlusLimpieza | |
| 13 | Plus por menor descanso | PlusesMenorDescanso > 0 | 1 | Resumen.ImportePlusMenorDescanso | |
| 14 | Plus navidad | Resumen.ImportePlusNavidad > 0 | 1 | convenio.ImportePlusNavidad | |
| 15 | Refuerzos | DiasConRefuerzo > 0 | DiasConRefuerzo | ImporteRefuerzos | |
| 16 | DNDs cobrados | TotalDndsCobrados + TotalDndsCobradosPorDescanso > 0 | esa suma | TablaSalarial.ImporteDndCobrado | |
| 17 | Seguro accidentes | SeguroAccidentes ≠ 0 | 1 | SeguroAccidentes | **No computa IRPF** |

Notas a la tabla:
- Si el Devengado está vacío, es Unidades × ImporteBase.
- El texto del concepto 3 depende de la categoría: Conductor → "Plus Conductor-Perceptor", Conductor_Formación → "Plus Conductor-Formación", Taquilla → "Plus Taquillero".

Al terminar se aplica 10.3.

### 10.3 Recalcular la nómina
1. Se actualiza el concepto de Antigüedad (si existe) con la antigüedad diaria según la FechaAntiguedad de la nómina: ImporteBase = antigüedadDiaria y Devengado = Unidades × antigüedadDiaria.
2. salarioMensual = (SueldoBaseMensual/30 + antigüedadDiaria) × 30.
3. Se calculan los importes:
   - BaseIrpf = suma de Devengado de los conceptos que computan para IRPF;
   - ProrrateoPagas = (salarioMensual × 3 + PagaSeptiembre) / 12;
   - BaseSeguridadSocial = BaseIrpf + ProrrateoPagas;
   - DescuentoIrpf = BaseIrpf × %IRPF / 100;
   - DescuentoSeguridadSocial = BaseSS × %SS / 100;
   - DescuentoDesempleo = BaseSS × %Desempleo / 100;
   - TotalDevengado = suma de todos los Devengado;
   - TotalDeducciones = suma de Deduccion + los tres descuentos;
   - TotalLiquido = TotalDevengado − TotalDeducciones.

## 11. Convenio
### 11.1 Incrementar importes en un X %
Cada importe se incrementa en importe × X / 100, redondeado a 2 decimales:
- del convenio: ImporteDietas, los pluses de sábados, festivos, menor descanso, limpieza, paquetería, nocturnidad, nocturnidad diaria y Navidad, e ImporteRefuerzos;
- de cada tabla salarial: el sueldo base diario, mensual y anual, ComplementoSalarial, BaseAntiguedad, PrecioQuebrantoMoneda, PrecioHoraExtra, PagaSeptiembre e ImporteDndCobrado (**no** se tocan SeguroAccidentes ni los porcentajes);
- de cada OpcionesCentro: ImportePlusViaje.

### 11.2 Valores por defecto de un convenio nuevo

| Campo | Valor |
|---|---|
| JornadaMedia | 7:20 |
| ImporteDietas | 15,37 |
| JornadaAnual | 1650 |
| Días de trabajo / descanso / vacaciones al año | 225 / 109 / 31 |
| DescansosSueltosAnuales | 15 |
| FindesCompletosAnuales | 21 |
| DiasTrabajadosSeguidos | 6 |
| Descansos sueltos, mínimo y máximo de descansos al mes | 2, 2 y 2 |
| MaximoFindesSeguidos | 2 |
| JornadaMaxima | 8:30 |
| JornadaMaximaFindes | 9:00 |
| JornadaMaximaPartida | 10:00 |
| TiempoPartidoMaximo | 3:00 |
| Nocturnas | 22:00–6:00 |
| LimiteDesayuno | 6:00 |
| Comida continua | 12:30–15:30 |
| Comida partida | 11:45–15:15 |
| Cena | 22:00–23:00 |
| LimitePlusCena | 0:00 |
| PorcentajeDesayuno | 80 |
| PorcentajePlusCena | 25 |
| MaximoLimpiezas | 21 |
| Plus festivos | 43,05 |
| Plus sábados | 21,53 |
| Plus menor descanso | 8,96 |
| Plus limpieza | 10,14 |
| Plus paquetería | 7,87 |
| Plus nocturnidad | 140,09 |
| Plus nocturnidad diario | 1,00 |
| Plus Navidad | 163,04 |
| Refuerzos | 4,94 |

Gráficos, servicios e itinerarios nuevos empiezan con todas las horas vacías.

## 12. Resumen mensual de un calendario (RecalcularResumenCalendario)
Recibe el calendario, el último día del mes anterior y el primer día del mes siguiente (pueden faltar). Si no hay resumen, se crea. Salvo que se diga otra cosa, todo se calcula sobre el **ServicioTrabajado** de cada día.

### 12.1 Contadores
- DiasActivo = días con incidencia ≠ Inactivo. DiasInactivo = días Inactivo.
- Hay un contador `Dias<Inc>` para cada incidencia: DiasTrabajo, DiasTrabajoJD, DiasTrabajoFN, DiasOV, DiasJD, DiasFN, DiasE, DiasDS, DiasDC, DiasF6, DiasF6D, DiasDND, DiasDF, DiasPER, DiasEJD, DiasEFN, DiasOVJD, DiasOVFN, DiasF6DC, DiasFORJD, DiasFORFN, DiasOVA, DiasOVAJD, DiasOVAFN, DiasLAC, DiasLACJD, DiasLACFN y DiasRE. **DiasFOR** cuenta FOR, FORJD y FORFN juntos.
- Por código: DiasCO = Comité, DiasCE = Comité_Empresa, DiasHorasSindicales = Horas_Sindicales. DiasComiteJD = algún código ≠ Ninguno y el día es descanso. DiasComiteDC = algún código ≠ Ninguno e incidencia DC.
- Sábados y domingos trabajados o descansados (EsTrabajo / EsDescanso), y festivos trabajados o descansados (con EsFestivo marcado).
- DiasTurno1 a DiasTurno4 según el turno. DiasConRefuerzo = días con Refuerzos > 0.
- Sumas de horas: HorasTrabajadas, HorasTrabajadasConvenio, HorasAcumuladas y HorasNocturnas (del trabajado). HorasAcumuladasVirtual (del virtual, ignorando los vacíos).
- Sumas de fracciones de dieta, redondeando cada día a 2 decimales: Desayunos, Comidas y Cenas, en versión trabajada y virtual.
- DiasConPlusPaqueteria = días con TienePlusPaqueteria. FacturadoPaqueteria = suma de lo facturado en los días sin plus fijo. PlusesPaqueteria = suma de PlusPaqueteria. Limpiezas = suma de Limpieza.
- Totales derivados: TotalDiasTrabajados = Trabajo + TrabajoJD + TrabajoFN + DC; TotalDescansos = JD + FN + DS + DF; TotalDiasVacaciones = OV + OVJD + OVFN; TotalDiasE = E + EJD + EFN; TotalDiasLAC = LAC + LACJD + LACFN; TotalDiasComite = CO + CE + HorasSindicales.

### 12.2 Validaciones y fines de semana (solo si hay convenio)
Errores empieza vacío y FindesCompletos en 0. Se recorren los días en orden con estos contadores: seguidos = 0, findesSeguidos = 0, sábadoTrabajado = falso, findesDescanso = 0. Para cada día d:
1. Si d no es el último del mes, d es sábado, d es descanso y el día siguiente también → FindesCompletos += 1 y findesDescanso += 1.
2. Si d es el día 1, es domingo y es trabajo → findesSeguidos += 1.
3. Si d > 1 es sábado y es trabajo → sábadoTrabajado = verdadero.
4. Si d > 1 es domingo: si sábadoTrabajado o d es trabajo, findesSeguidos += 1; si no, findesSeguidos = 0. Después sábadoTrabajado = falso.
5. Si d es trabajo, seguidos += 1. Si no lo es: cuando seguidos > DiasTrabajadosSeguidos se añade "Día DD: Más de N días trabajados." (DD = día con dos cifras y N = el máximo del convenio); y en cualquier caso seguidos = 0.
6. Si d es sábado, domingo o festivo y TrabajadasConvenio > JornadaMaximaFindes → "Día DD: Exceso de horas trabajadas en fin de semana o festivos.". Si es laborable y TrabajadasConvenio > JornadaMaxima → "Día DD: Exceso de horas trabajadas en laborables.".
7. Si el turno es 4 (partido): TiempoTotal > JornadaMaximaPartida → "Día DD: Exceso de tiempo total en gráfico partido."; TiempoPartido > TiempoPartidoMaximo → "Día DD: Exceso de tiempo partido.".

Después del recorrido:
- Si el día 1 es domingo y descanso y el último día del mes anterior también es descanso → FindesCompletos += **0,5**. Si el último día es sábado y descanso y el primero del mes siguiente también → += 0,5. En ambos casos sin tocar findesDescanso.
- Si hay más DS que DescansosSueltosMes → "Más de N descansos sueltos en un mes.".
- Si los días de trabajo son ≥ (días del mes − 8) y hay menos días de descanso que MinimoDescansosMes → "Menos de N descansos en un mes.".
- Si hay más días de descanso que MaximoDescansosMes → "Más de N descansos en un mes.". **[?]** Con los valores por defecto (2) este error saltaría casi siempre. Es lo que hace el original; hay que confirmarlo con el usuario.
- Salvo que el conductor sea FijoInaplicacion: si findesSeguidos (el valor al terminar el mes) > MaximoFindesSeguidos → "Más de N fines de semana trabajados seguidos."; y si el mes es julio, agosto o septiembre y findesDescanso < 2 → "Menos de dos fines de semana de descanso en un mes de verano.".
- Cada error termina en salto de línea. Al final se quita el último.

### 12.3 Importes
- ImportePlusPaqueteria = PlusesPaqueteria. PlusesMenorDescanso = suma del plus de cada día (redondeado a 2). ImportePlusMenorDescanso = esa suma redondeada a 2.
- **Solo para conductores Eventuales** (en el resto, 0):
  - vacMes = DiasVacacionesAnuales / 12;
  - findesYFestivos = días que son sábado o domingo + días marcados como festivo. Un festivo en fin de semana cuenta dos veces;
  - DiasDeberiaDescansar = redondear(DiasActivo × ((díasMes − vacMes) × findesYFestivos / díasMes) / díasMes, 4);
  - DiasDeberiaVacaciones = redondear(DiasActivo × vacMes / díasMes, 4);
  - DiasDeberiaTrabajar = redondear(DiasActivo − DeberiaDescansar − DeberiaVacaciones, 4).
- TotalDietas = Desayunos × PorcentajeDesayuno / 100 + Comidas + Cenas. ImporteDietas = redondear(TotalDietas, 2) × convenio.ImporteDietas. Lo mismo para la versión virtual.
- ImportePlusSabados = (sábados trabajados **no festivos**) × ImportePlusSabados.
- ImportePlusFestivos = (DomingosTrabajados + FestivosTrabajados) × ImportePlusFestivos.
- ImportePlusNocturnidad = DiasTurno3 × ImportePlusNocturnidad.
- ImportePlusNocturnidadParcial = Horas(suma de nocturnas de los días con turno ≠ 3) × ImportePlusNocturnidadDiario.
- ImportePlusNavidad = ImportePlusNavidad del convenio si (diciembre y el 25 es trabajo) o (enero y el 1 es trabajo); si no, 0.
- ImporteQuebrantoMoneda = TotalDiasTrabajados × PrecioQuebrantoMoneda de la tabla salarial de la categoría del conductor.
- Se buscan las OpcionesCentro del centro del conductor. **Si no existen, el cálculo termina aquí.**
- **Limpiezas** (TotalLimpiezas):
  - si LimpiezasMes > 0 y TotalDiasTrabajados > 0: para Fijo o FijoInaplicacion, LimpiezasMes − (DiasE + DiasDND + DiasF6 + DiasPER), con mínimo 0; para el resto, TotalDiasTrabajados, y si pasa de 21, MaximoLimpiezas;
  - si LimpiezasMes > 0 pero no hay días trabajados → 0;
  - si LimpiezasMes ≤ 0: la suma de Limpiezas de los días, y si pasa de 21, MaximoLimpiezas;
  - ImportePlusLimpieza = redondear(TotalLimpiezas × ImportePlusLimpieza, 2).
- ImportePlusViaje = PagarPlusViaje ? (TotalDiasTrabajados − DiasDC − DiasDND) × ImportePlusViaje : 0.
- variables = plus sábados + festivos + nocturnidad + limpieza. ImporteVariableVacaciones: para Fijo o FijoInaplicacion, redondear(variables / 11, 4); para el resto, redondear(variables / 11 / 31, 4) × DiasDeberiaVacaciones.
- ImporteRefuerzos = DiasConRefuerzo × ImporteRefuerzos.
- TotalDndsCobrados = días con DndCobrado; su importe es ese número × TablaSalarial.ImporteDndCobrado. TotalDndsCobradosPorDescanso = suma de DndsCobradosPorDescanso; su importe, la suma × ImporteDndCobrado.

## 13. Propiedades derivadas de reclamaciones
- Por concepto: HorasReclamadas = HorasReales − HorasCobradas; ImporteReclamado = ImporteReal − ImporteCobrado; IncidenciasReclamadas = IncidenciasReales − IncidenciasCobradas.
- Por reclamación:
  - Horas = suma de HorasReclamadas;
  - Dietas = suma del ImporteReclamado de los conceptos DietaDesayuno, DietaComida y DietaCena;
  - Pluses = lo mismo para PlusSabados, PlusFestivos, PlusPaqueteria, PlusLimpieza, PlusMenorDescanso, PlusNocturnidad, PlusNocturnidadParcial y PlusNavidad;
  - Importe = suma de ImporteTotal (cada uno redondeado a 2);
  - Resuelta = tiene conceptos y todos están resueltos.
- Cómo se muestra el valor de un concepto según su tipo: TotalDc y TotalDnd, como importe con 4 decimales; HorasTrabajadas, HorasAcumuladas y OtraHoras, como horas; dietas, pluses, quebranto, refuerzos y OtraImporte, como importe con 2 decimales; Grafico y las incidencias (Descanso, Enfermo, DC, DND, F6), vacío.
- Estado de un registro en el cliente: Id = 0 → Nuevo; Modified → Modificado; si no, Sin cambios.
- Un gráfico tiene "valoración diferente" cuando Valoracion ≠ TrabajadasConvenio.

## 14. Generar la reclamación de un mes (desde el detalle del calendario)
1. Se busca la reclamación del conductor para ese mes:
   - si no existe, se crea una vacía;
   - si existe y está **resuelta** o **cerrada**, se muestra un error y se para;
   - si existe y tiene conceptos, esos conceptos se borran.
2. Codigo = `yyyyMM` + matrícula (sin separador). FechaEfecto = ahora.
3. **Conceptos de importes mensuales**. Para cada par (Resumen.X real frente a Calendario.TotalX cobrado), si el real redondeado a 2 es mayor que el cobrado redondeado a 2, se crea o reutiliza un concepto de ese tipo con Fecha = 01/01/0001, GraficoTrabajado = 0, ImporteCobrado, ImporteReal e ImporteTotal = Real − Cobrado. Los pares son:
   - PlusSabados ("Importe plus de sábado")
   - PlusFestivos ("Importe plus de festivo")
   - PlusNocturnidad ("Importe plus de nocturnidad")
   - PlusNocturnidadParcial ("Importe plus de nocturnidad parcial")
   - PlusPaqueteria ("Importe plus de paquetería")
   - PlusLimpieza ("Importe plus de limpieza")
   - PlusMenorDescanso ("Importe plus por menor descanso")
   - PlusNavidad ("Importe plus de Navidad")
   - PlusViaje ("Importe plus de viaje")
   - QuebrantoMoneda ("Importe quebranto de moneda")
   - Refuerzos ("Importe refuerzos")
   - DndsCobrados ("Importe DNDs cobrados"): real = ImporteDndsCobrados + PorDescanso; cobrado = TotalImporteDndsCobrados.
4. **DCs y DNDs pendientes** (15) frente a Calendario.TotalDcsPendientes / TotalDndsPendientes. Si el pendiente calculado es mayor, se crea un concepto TotalDc ("DCs pendientes") o TotalDnd ("DNDs pendientes") con ImporteCobrado = valor del calendario, ImporteReal = valor calculado e ImporteTotal = 0.
5. **Por cada día** se crea o reutiliza un concepto del mismo tipo y fecha, con GraficoTrabajado = número trabajado:
   - Trabajado.Acumuladas > Virtual.Acumuladas → HorasAcumuladas ("Horas acumuladas del día D"), HorasCobradas = virtual, HorasReales = trabajado, ImporteTotal = 0;
   - Desayuno trabajado mayor que el virtual (ambos redondeados a 2) → DietaDesayuno ("Dieta de desayuno del día D"), con ImporteTotal = (Real − Cobrado) × convenio.ImporteDietas. Lo mismo para Comida (DietaComida) y Cena (DietaCena);
   - incidencias distintas entre trabajado y virtual → el concepto de 9 (con la incidencia trabajada como "real" y la virtual como "esperada"), con importes a 0;
   - números de gráfico distintos → Grafico ("Gráfico diferente el día D (N virtual)"), con importes a 0.
6. **Notas**, con los totales:
   - "Total dietas = X (Y €)": X = suma del ImporteReclamado de las dietas e Y = suma de su ImporteTotal;
   - "Total pluses = Z €": suma del ImporteTotal de los pluses y los refuerzos;
   - "Total quebranto moneda = Q €";
   - "IMPORTE TOTAL = Y+Z+Q €";
   - "TOTAL HORAS = H": suma de HorasReclamadas.

   Cada línea solo aparece si su valor es mayor que 0.
7. Se abre el diálogo de detalle de la reclamación para revisarla. Al aceptar, se guarda (alta o modificación) y se borran los conceptos eliminados.

## 15. Saldos acumulados del conductor (detalle del calendario)
Se usan el resumen acumulado desde enero hasta el mes anterior (API `resumenes/hastaMes`) y el resumen del mes actual. Las regulaciones válidas son las de fecha anterior al primer día del mes siguiente.
- **HorasAcumuladasHastaMes** = AcumuladasIniciales + Σ Horas de las regulaciones válidas + (HorasAcumuladasVirtual del acumulado + las del mes) − DiasF6 (acumulado hasta el año anterior) × JornadaMedia − (DiasF6D acumulados + DiasF6D del mes) × JornadaMedia.
- **DCsPendientesHastaMes** = DcsIniciales + Σ DCs de las regulaciones válidas − (DiasDC acumulados + del mes) − (DiasF6DC acumulados + del mes) − DCs reclamados en reclamaciones "en curso" hasta el mes anterior.
- **DNDsPendientesHastaMes** = DndsIniciales + Σ DNDs de las regulaciones válidas + (ComiteJD + TrabajoJD + TrabajoFN acumulados) + (ComiteJD + TrabajoJD + TrabajoFN + FORJD + FORFN del mes) − (DND + DF acumulados y del mes) − (TotalDndsCobrados acumulados y del mes) − DNDs reclamados en curso.
- **DCsGeneradosHastaMes** = DCsPendientes + Horas(HorasAcumuladasHastaMes) / Horas(JornadaMedia).
- **VacacionesPendientesHastaMes** (solo para Eventuales) = DiasDeberiaVacaciones (acumulado + mes) − TotalDiasVacaciones (acumulado + mes).
- **Horas por tipo de regulación**. En el mes: regulaciones del mismo año y mes. En el año: del mismo año y de meses anteriores, más las del mes.
  - HorasCobradas = regulaciones Horas_Cobradas;
  - HorasReguladas = Regulacion_Anual;
  - OtrasHoras = Manual.
- **ImporteTotalPluses** del mes = sábados + festivos + limpieza + nocturnidad + nocturnidad parcial + Navidad + viaje + menor descanso + paquetería + refuerzos + quebranto.
- Los totales "del año" suman cada campo del mes al resumen acumulado del año.
- **TotalDescansosReguladosAño** = (TotalDescansos + DndsCobradosPorDescanso del mes y del año) − (DiasF6D del mes y del año), pero solo si (DndsCobradosPorDescanso + DiasF6D) > 0. Si no, 0.

## 16. Extraer gráficos del texto de los PDF de la empresa
> Fuente: `Orion2.dll`, `ProcesoGraficosService.ExtraerGraficosAsync` (máquina `<ExtraerGraficosAsync>d__6`), `ExtraerItinerarioAsync` y `ExtraerGraficosPdfViewModel` (`<ExtraerDePdf>d__49`, `<Procesar>d__58`, `<GuardarGrupos>d__62`), leídos con `rea inspect-managed-members` y un decodificador de IL propio. `Textos.ExtractInt`, `ExtractTimeSpan`, `QuitarEspaciosExtra` y `TrimEveryLine` están en `Nelya.Core.dll` y no se han leído: su comportamiento aquí es **inferido** por el nombre y el uso.

### 16.1 Preparación del texto
- El original extraía el texto del PDF página a página; cada página se podía revisar y editar a mano, guardar en un .txt y volver a abrir. A cada página se le quitan los espacios repetidos y se recorta cada línea (inferido).
- Al procesar, las páginas se unen con saltos de línea. Si no se ha cambiado la fecha del grupo, se pide confirmación ("No has cambiado la fecha del grupo de gráficos…").
- El texto se parte en líneas; se descartan las vacías y se recortan los espacios de los extremos.

### 16.2 Recorrido de las líneas
Se mantiene: centro actual (al principio "Todos"), tipo de día actual (al principio "Ninguno"), gráfico abierto (ninguno), hora de inicio y hora final del gráfico (vacías) y un texto pendiente (vacío). Las palabras clave se comparan al **principio** de la línea, sin distinguir mayúsculas.

**Sin gráfico abierto**, la primera regla que se cumpla:
- `lunes` → tipo de día Lunes-Jueves; `viernes` → Viernes; `sábado` o `sabado` → Sábado; `festivos` → Festivo.
- `donosti` → Donosti; `bilbao` → Bilbao; `arrasate` → Arrasate; `vitoria` o `gasteiz` → Vitoria; `pruebas` → Pruebas.
- `grafikoa` → se abre un gráfico nuevo con número = primer entero de la línea (inferido), el centro y tipo de día actuales y la fecha de validez del grupo. **Turno**: número impar → Mañana; par → Tarde.
- Cualquier otra línea se ignora.

**Con un gráfico abierto**:
- `balorazioa` → valoración = primera hora `h:mm` de la línea (inferido; si no hay, 0). El gráfico toma como Inicio la hora de inicio acumulada y como Final la hora final acumulada (si esta pasa de 24 h se le resta un día). Se cierra el gráfico, se añade a la lista y se vacían las horas de inicio y final. **No** se vacía el texto pendiente.
- Cualquier otra línea (incluidas las que empiezan por una palabra clave de día o centro) se interpreta como línea de itinerario (16.3). Si no da nada, se ignora. Si da un itinerario:
  1. Si no tiene hora de inicio y sí descripción, en la descripción se cambia "vacio"→"vacío" y "Vacio"→"Vacío"; si el gráfico ya tiene algún itinerario y la descripción empieza por "vacío" (sin distinguir mayúsculas), el itinerario hereda como inicio el **final del último itinerario** del gráfico.
  2. Si sigue sin hora de inicio es una línea de texto: si el gráfico aún no tiene itinerarios, se acumula en el texto pendiente (separado por saltos de línea); si los tiene, se añade a la descripción del último itinerario (con un salto de línea) y se vacía el pendiente.
  3. Si tiene hora de inicio: si el primer itinerario del gráfico empieza más tarde que este, al inicio de este se le suma un día (cruza la medianoche). Si la hora de inicio del gráfico está vacía, toma la de este itinerario. Si el itinerario tiene final, pasa a ser la hora final del gráfico. Si hay texto pendiente, se antepone a la descripción ("pendiente\ndescripción") y se vacía. Se añade el itinerario al gráfico.
- Un gráfico que no llega a cerrarse con `balorazioa` se pierde sin aviso.

### 16.3 Línea de itinerario
1. Formatos de horas admitidos, que se normalizan a "HH:MM HH:MM":
   - "HH:MM a HH:MM" (en cualquier punto de la línea): se quita " a" de la primera aparición de " a ".
   - "HH:MM-HH:MM": el primer guion pasa a ser un espacio.
   - Línea completa "Reserva de HH:MM HH:MM" (sin distinguir mayúsculas): queda "HH:MM HH:MM Reserva".
2. Se parte por espacios (sin trozos vacíos). Si no hay trozos, no hay itinerario.
3. Si el primer trozo contiene ":" y es una hora válida → inicio. Si no, el itinerario es solo texto: descripción = la línea entera.
4. Si solo hay un trozo, el itinerario tiene solo inicio.
5. Si el segundo trozo es un entero → es el número de itinerario. Si existe en el catálogo de itinerarios (de las líneas), final = inicio + TiempoPago (minutos) y tiempo total = final − inicio. Descripción = el resto de trozos.
6. Si no, si el segundo trozo es una hora → final, tiempo total = final − inicio y descripción = el resto de trozos.
7. Si no, descripción = todos los trozos desde el segundo.

### 16.4 Guardar
- Si algún gráfico tiene centro "Todos" → error "No se pueden guardar gráficos para todos los centros."
- Si la fecha de algún gráfico no coincide con la fecha del grupo → error "Procesa los gráficos de nuevo."
- Por cada centro distinto, si ya existe un grupo con esa fecha → error "Ya existe un grupo con fecha dd-MM-yyyy para el centro de X." y no se guarda nada.
- Por cada centro se añade además un gráfico con **número 0** (centro y fecha del grupo, sin horario), después se guardan todos los gráficos y se informa de los grupos creados ("dd-MM-yyyy Centro").

### 16.5 Diferencias deliberadas en Mercurio
- Las horas se guardan como horas del día (0–24 h): no se suma un día al inicio de los itinerarios de después de medianoche ni se resta al final del gráfico; las duraciones se calculan con `Horas.Duracion`, que ya cruza la medianoche. El original restaba final − inicio sin más y podía dar tiempos negativos.
- El centro inicial es el seleccionado en la aplicación (el original empezaba siempre en "Todos"); las palabras clave de centro lo cambian igual.
- Una línea `grafikoa` sin número no abre gráfico, y los gráficos sin `balorazioa` se descartan, pero ambos casos generan un **aviso** en lugar de perderse sin más.
- "HH:MM a HH:MM" y "HH:MM-HH:MM" se corrigen justo donde aparecen (el original quitaba la primera " a " o el primer guion de la línea, aunque estuvieran en otro sitio). Una hora es `h:mm` o `hh:mm` (el original aceptaba también segundos).
- La descripción no lleva el espacio final que dejaba el original y una descripción vacía queda vacía (`null`).
- Al guardar se rechazan también los números de gráfico repetidos dentro de un centro y, si existe el convenio del año, los gráficos se recalculan antes de guardarlos (el original pedía recalcularlos después a mano).
- Extraer el texto de un PDF directamente necesita una librería externa. De momento se pega el texto o se carga un .txt.

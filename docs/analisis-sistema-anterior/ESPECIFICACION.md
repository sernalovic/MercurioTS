# El sistema anterior: especificación funcional para su reconstrucción

> Documento elaborado a partir de un análisis estático de los ensamblados instalados del sistema anterior (v0.2.0, AnderSoft)
> hecho con REA, sin ejecutar el programa, y de una inspección pasiva de la parte pública de
> https://orion2.azurewebsites.net/. Describe **qué hace** el sistema para poder reimplementarlo desde cero.
> No contiene código del original.
>
> Leyenda: **[O]** observado en el binario o en la web · **[I]** inferido · **[?]** desconocido, pendiente de confirmar.

## 1. Arquitectura actual

| Pieza | Tecnología | Notas |
|---|---|---|
| Aplicación de escritorio "El sistema anterior" | WPF .NET 7, MVVM (CommunityToolkit), Syncfusion, AutoMapper, QuestPDF/iText (PDF), EPPlus (Excel) **[O]** | Solo para **administradores**. Mensaje literal: "El usuario debe ser administrador para acceder a Mercurio" **[O]**. Se distribuye con ClickOnce. |
| Servidor `orion2.azurewebsites.net` | ASP.NET Core en Azure App Service **[O]** | Un único host con tres funciones: (a) web MVC/Razor para los trabajadores, (b) API REST `api/v1/...` con token *bearer* **[O]** (sin token devuelve 401), (c) hub SignalR `/calendariosHub` **[O]**. |
| Base de datos | **[I]** SQL Server / Azure SQL con EF Core (entidades `*Entity` con `Id` + `ModifiedDate`/`ModifiedBy`) | **[?]** No se ve desde el cliente. |
| Usuarios | ASP.NET Identity **[I]**: login con `UserName` y `Password`, "Recordarme", recuperar contraseña (`/Account/NewRecoverPassword`) **[O]** | Roles: `IsAdmin`, `IsSuper`, `IsAfiliado`, `IsLocked`, `EmailConfirmed` **[O]**. |
| Tiempo real | SignalR: el servidor emite `CalendarioChanged(fecha, centro, idCalendario, int[] días)` a todos los clientes salvo al emisor **[O]** | El escritorio se suscribe y marca los días como "modificado en remoto". |
| Marca | Web con logotipos de **UGT FeSMC**, Bootstrap, Font Awesome y Chart.js **[O]** | Es una herramienta sindical para controlar calendarios, horas y nóminas de conductores de autobús. |

Las clases `Orion2.Shared` (modelos, entidades, enumeraciones, cálculos y el hub) están compartidas entre el escritorio y el servidor **[I]**, porque `CalendariosHub` es una clase de servidor. Por tanto, **los cálculos de horas, dietas y pluses son los mismos en ambos lados**.

## 2. Dominio

### 2.1 Enumeraciones **[O]**
Los valores numéricos se asumen 0, 1, 2… en el orden indicado **[I]**.

- **CentroTrabajo**: Todos, Donosti, Bilbao, Arrasate, Vitoria, Pruebas
- **CategoriaTrabajador**: Conductor, Conductor_Formación, Taquilla
- **CategoriaGrafico**: Conduccion, Taquilla
- **SituacionTrabajador**: Fijo, Eventual, Inactivo, FijoInaplicacion
- **Turno**: Sin_Turno, Mañana, Tarde, Noche, Partido
- **TipoDia**: Ninguno, Lunes_Jueves, Viernes, Sabado, Festivo, Reserva, Reduccion_Jornada
- **Incidencia** (situación del día): Inactivo, Trabajo, TrabajoJD, TrabajoFN, JD, FN, DS, DND, DC, F6, F6DC, PER, OV, OVJD, OVFN, E, EJD, EFN, FOR, FORJD, FORFN, OVA, OVAJD, OVAFN, LAC, LACJD, LACFN, RE, DF, F6D
- **CodigoIncidencia**: Ninguno, Comité, Comité_Empresa, Horas_Sindicales
- **TipoServicio**: Anual, Trabajado, Virtual
- **TipoRegulacion**: Manual, Horas_Cobradas, Regulacion_Anual
- **TipoNomina**: Mensual, PagaExtra, Atrasos
- **TipoConceptoNomina**: SalarioBase, Antiguedad, ComplementoSalarial, QuebrantoMoneda, PlusViaje, PlusSabados, PlusFestivos, Dietas, PlusNocturnidad, PlusNocturnidadParcial, PlusPaqueteria, PlusLimpieza, PlusMenorDescanso, PlusNavidad, Refuerzos, DndsCobrados, SeguroAccidentes, VariablesVacaciones
- **TipoReclamacion**: TotalDc, TotalDnd, Grafico, HorasTrabajadas, HorasAcumuladas, DietaDesayuno, DietaComida, DietaCena, PlusSabados, PlusFestivos, PlusPaqueteria, PlusLimpieza, PlusMenorDescanso, PlusNocturnidad, PlusNocturnidadParcial, PlusNavidad, PlusViaje, DndsCobrados, QuebrantoMoneda, Refuerzos, Descanso, Enfermo, DC, DND, F6, OtraHoras, OtraImporte

**Siglas [?]**, que hay que confirmar con el usuario: JD (jornada de descanso), FN (fin de semana), DS (descanso), DC (día de compensación), DND (descanso no disfrutado), F6 (festivo), OV (vacaciones), E (enfermedad), FOR (formación), LAC (lactancia), PER (permiso), RE (reserva), DF.
Texto a incidencia **[O]**: se aceptan abreviaturas en minúsculas (`trab`, `ov`, `jd`, `fn`, `f6dc`, `inac`, `tjd`, `efn`…). El sufijo `jd`/`fn` indica en qué tipo de descanso cae el día. Un número indica un gráfico trabajado. `*` y `>` son marcadores **[?]**.

### 2.2 Entidades
Todos los tipos de tiempo son duraciones (`TimeSpan`) y los importes son `decimal`.

- **Conductor**: Centro, Categoria, Situacion, **Matricula** (número de empleado, clave natural), IsUsuario, FechaAntiguedad, PorcentajeIrpf, NumeroAfiliado, IsReduccionJornada, PorcentajeJornada, Nombre, Apellidos, Telefono, Email, AcumuladasIniciales (horas), DcsIniciales, DndsIniciales, PlusDistancia, Notas → *Regulaciones*, *Reclamaciones*.
- **Regulacion**: Conductor, Tipo, Fecha, Horas, DCs, DNDs, Motivo.
- **Convenio** (uno por año, `Año` único): JornadaMedia, ImporteDietas, JornadaAnual, Días de trabajo, descanso y vacaciones anuales, DescansosSueltosAnuales, FindesCompletosAnuales, DiasTrabajadosSeguidos, DescansosSueltosMes, Mínimo y máximo de descansos al mes, MaximoFindesSeguidos, JornadaMaxima, JornadaMaximaFindes, JornadaMaximaPartida, TiempoPartidoMaximo, inicio y fin del horario nocturno, LimiteDesayuno, ventanas de comida (continuo y partido), ventana de cena, LimitePlusCena, PorcentajeDesayuno, PorcentajePlusCena, MaximoLimpiezas, importes de los pluses (festivos, sábados, menor descanso, limpieza, paquetería, nocturnidad, nocturnidad diaria, Navidad) e ImporteRefuerzos → *TablasSalariales*, *OpcionesCentro*.
- **TablaSalarial** (por convenio y categoría): sueldo base diario, mensual y anual, ComplementoSalarial, BaseAntiguedad, PrecioHoraExtra, PrecioQuebrantoMoneda, PagaSeptiembre, ImporteDndCobrado, SeguroAccidentes, % Seguridad Social y % desempleo.
- **OpcionesCentro** (por convenio y centro): NumerosL, NumerosV, NumerosS, NumerosF y NumerosR (rangos de números de gráfico para L‑J, viernes, sábado, festivo y reserva, como texto del tipo "1-50,60"), LimpiezasMes, PagarPlusViaje, ImportePlusViaje → *Festivos* (fechas).
- **Grafico** (un turno tipo; se agrupan por Centro y por fecha de validez, el "grupo de gráficos"): Numero, Categoria, TipoDia, Turno, Inicio, Final, InicioPartido, FinalPartido, Valoracion, NoCalcular. **Campos calculados**: TiempoTotal, TiempoPartido, Trabajadas, TrabajadasConvenio, TiempoVacio, Acumuladas, Nocturnas, Desayuno, Comida, Cena, PlusCena, TienePlusPaqueteria y TieneErrorTiempoPartido → *ItinerariosGrafico* (Inicio, Itinerario, Descripcion, Final, TiempoTotal).
- **Linea** → **Itinerario** (Nombre, Descripcion, TiempoReal, TiempoPago) → **Parada** (Orden, Descripcion, Tiempo).
- **Calendario** (uno por conductor y mes): Centro, Fecha (mes), totales en euros de cada plus, DCs y DNDs pendientes → *Dias* y un *Resumen*.
- **DiaCalendario**: Fecha, EsFestivo, Notas, Vehiculos, Refuerzos, DndCobrado, DndsCobradosPorDescanso, y **tres servicios** (ServicioTrabajado, ServicioAnual y ServicioVirtual).
  - **Servicio** (comparten estructura): Incidencia, Codigo, NoCalcular, los mismos horarios y campos calculados que un Grafico, más TienePlusPaqueteria, PlusPaqueteria, FacturadoPaqueteria, Limpieza y PlusMenorDescanso.
  - *Anual* = lo planificado en el calendario anual de la empresa. *Trabajado* = lo realmente hecho. *Virtual* = lo que debería haberse hecho según convenio. La comparación entre los tres genera las diferencias "en contra" que se reclaman **[I]**.
- **ResumenCalendario** (unos 90 contadores mensuales): días por cada incidencia, sábados, domingos y festivos trabajados o descansados, días por turno, fines de semana completos, días que debería trabajar, descansar o tener de vacaciones, horas trabajadas, acumuladas y nocturnas, dietas reales y virtuales, paquetería, limpiezas, importes de cada plus, variable de vacaciones, DNDs cobrados, y **Errores** (texto).
- **Reclamacion** (por conductor y mes): Fecha, FechaEfecto, Codigo, Notas, NotaInterna, Cerrada → *ConceptosReclamados* (Fecha, Tipo, Descripcion, GraficoTrabajado, HorasReales y HorasCobradas, ImporteReal e ImporteCobrado, IncidenciasReales e IncidenciasCobradas, ImporteTotal, Resuelto).
- **Nomina** (por conductor y mes): TipoNomina, periodo, FechaAntiguedad, % IRPF, % Seguridad Social y % desempleo, bases, prorrateo de pagas, descuentos, totales (devengado, deducciones y líquido) → *ConceptosNomina* (Tipo, Codigo, ComputaParaIrpf, Texto, Unidades, ImporteBase, Devengado, Deduccion).
- **Usuario**: UserName, Matricula, Nombre, Apellidos, FechaAlta, IsAfiliado, IsAdmin, IsSuper, IsLocked, EmailConfirmed.

## 3. Reglas de negocio conocidas

### 3.1 Cálculo de un servicio o gráfico (`CalculosService`) **[O]** nombres · **[?]** fórmulas
Las funciones que existen son: EsFestivo, FestivosEnMes, HayFestivos y Hay14Festivos (comprueba que un centro tenga sus 14 festivos), Trabajadas, TrabajadasConvenio, TiempoTotal, Acumuladas, Nocturnas, Desayuno, Comida (con variantes para jornada completa, parcial y partida), Cena, PlusCena, TiempoPartidoComida, GetTipoDiaGrafico (deduce el tipo de día a partir del número de gráfico y de los rangos de OpcionesCentro), RecalcularServicio, RecalcularGrafico, RegenerarDia, RecalcularPlusMenorDescanso y RecalcularResumenCalendario.
Al cambiar en un servicio cualquiera de los campos Inicio, Numero, Final, Turno, InicioPartido, FinalPartido, TienePlusPaqueteria, FacturadoPaqueteria o Incidencia, el servicio se recalcula **[O]**.
**Pendiente**: sacar las fórmulas exactas, que son la parte crítica. Ver 7.

### 3.2 Validaciones del calendario, que se escriben en `Resumen.Errores` **[O]**
- "Día N: Más de X días trabajados" (se compara con `DiasTrabajadosSeguidos`).
- "Exceso de horas trabajadas en fin de semana o festivos" (`JornadaMaximaFindes`) y "… en laborables" (`JornadaMaxima`).
- "Exceso de tiempo total en gráfico partido" (`JornadaMaximaPartida`) y "Exceso de tiempo partido" (`TiempoPartidoMaximo`).
- "Más de X descansos sueltos en un mes" y "Menos de X descansos en un mes".
- "X fines de semana trabajados seguidos" (`MaximoFindesSeguidos`).
- "Menos de dos fines de semana de descanso en un mes de verano".

### 3.3 Diferencias "en contra" del trabajador (`CalendarioUtils`) **[O]**
Se calculan diferencias de acumuladas, nocturnas, desayunos, comidas, cenas, paquetería, menor descanso, plus de sábados, festivos, nocturnidad (completa y parcial), limpieza, Navidad, viaje, quebranto de moneda, refuerzos y DNDs cobrados. Con ellas se marca `TieneDiferenciasEnContra` y se genera la **reclamación** del mes.
AjustarJDs: "cambiará JD por DS o FN donde corresponda" **[O]**.

### 3.4 Nómina (`NominasHelper.GenerarNomina`) **[O]** conceptos · **[?]** fórmulas
Conceptos en este orden: Salario base, Antigüedad (porcentaje según años, `GetPorcentajeAntiguedad`), Plus Conductor-Perceptor, Plus Conductor-Formación, Plus Taquillero, Complemento salarial, Quebranto de moneda, Plus viaje, Plus de sábados, Plus de festivos, Dietas, Plus nocturnidad, Plus nocturnidad parcial, Paquetería, Plus limpieza, Plus por menor descanso, Plus Navidad, Refuerzos, DNDs cobrados y Seguro de accidentes. Después se aplican las deducciones: Seguridad Social, desempleo e IRPF.

### 3.5 Reclamaciones **[O]**
- Una por conductor y mes. No se puede generar otra si la existente está resuelta o cerrada.
- Se genera desde el detalle del calendario con todas las diferencias del mes.
- Exporta a PDF con el título "RECLAMACIÓN DE CONCEPTOS", el centro, el trabajador, la lista de conceptos, el número de reclamación y un espacio para la firma.
- Para generar el PDF tiene que estar "en curso".

### 3.6 Gráficos
- Se importan desde PDF (pasándolos a texto y procesándolos con expresiones regulares del tipo "HH:MM a HH:MM" y "Reserva de HH:MM HH:MM").
- Hay también un importador específico desde Excel para Arrasate **[O]**.
- Los grupos se pueden exportar e importar en JSON.
- Se pueden comparar dos grupos: turno, inicio, final, partido y valoración diferentes **[O]**.

## 4. Pantallas de la aplicación de administración (escritorio) **[O]**

| Módulo | Acciones |
|---|---|
| Login | Usuario y contraseña. Solo administradores. Opciones (URL de la API). |
| Menú principal | Conductores, Gráficos, Calendarios, Líneas, Convenios, Informes, Reclamaciones, Nóminas, Herramientas, Opciones, Usuarios (solo superusuario). Avisa si falta el convenio del año siguiente. |
| Conductores | Listar (agrupar por categoría, situación o centro), añadir, editar, borrar (borra en cascada calendarios, reclamaciones, etc.), deshacer, regulaciones (CRUD), ver calendarios del conductor. |
| Gráficos | Grupos por centro y fecha: crear, importar JSON, borrar y exportar. Gráficos del grupo: CRUD, recalcular, deducir turno y tipo de día, detalle con itinerarios (calcular e importar el tiempo de pago desde Líneas). Totales T1 a T4, trabajadas, acumuladas y nocturnas. |
| Calendarios | Mes y centro: listado (agrupar por categoría o situación), añadir calendarios anuales o quincenales, borrar, ajustar JDs, marcar festivos, recalcular resúmenes, regenerar día o todos, ver anuales y virtuales, por trabajador, detalle. |
| Detalle de calendario | Rejilla mensual con los tres servicios, detalle de día, totales, recalcular (día, calendario o resumen), regenerar, marcar festivos, ajustar JDs, **generar reclamación**, **generar nómina**, regular DCs (regulación anual). |
| Líneas | Líneas, itinerarios y paradas (CRUD), importar y exportar JSON. |
| Convenios | CRUD por año (copiando de otro), opciones por centro (rangos de números, festivos y su propagación a otros centros, limpiezas, plus viaje), tablas salariales, incrementar importes en un porcentaje. |
| Reclamaciones | Por conductor: CRUD, conceptos, marcar como resuelta, PDF, recalcular notas. |
| Nóminas | Por conductor: listar, detalle, cambiar antigüedad o % IRPF y recalcular, borrar. |
| Informes (PDF) | Asignación de gráficos en el mes, Comparar grupos de gráficos, Errores de calendarios, Estadísticas de calendarios (por conductor o por gráfico), Estadísticas de reclamaciones (mes o año, con filtros de categoría y situación), Realización de gráficos. |
| Herramientas | Exportar calendarios "crudos" a Excel, extraer gráficos de PDF, extraer gráficos de Excel (Arrasate). |
| Usuarios | Listado de usuarios web, enviar emails (a todos, afiliados, administradores, superusuarios o una selección). |

## 5. Portal web de los trabajadores
- **[O]** Página pública: aviso de cookies, "Inicie sesión para poder operar con el sistema anterior", login (`/Account/Login`), recuperar contraseña, privacidad. Pie: "© 2020 - el sistema anterior".
- **[O]** Se usa Chart.js, lo que apunta a que hay gráficas en la zona privada.
- **[?]** Contenido de la zona privada. Probablemente el trabajador ve su calendario, sus resúmenes, sus reclamaciones y sus nóminas, y puede editar los días (de ahí el evento SignalR `CalendarioChanged` y el campo `IsRemoteUpdated`). **Para confirmarlo hace falta entrar con un usuario trabajador**: tiene que iniciar sesión el propio usuario en el navegador integrado.

## 6. API REST actual (`/api/v1`, JSON camelCase, fechas `yyyy-MM-dd`) **[O]**
Recursos: `account` (login, basicos, sendMail), `conductores`, `regulaciones`, `graficos`, `itinerariosGraficos`, `convenios` (+ `festivos`), `lineas`, `itinerarios`, `paradas`, `calendarios`, `resumenes`, `reclamaciones`, `conceptosReclamados`, `nominas`.
El patrón es el mismo para todos: `GET /x`, `GET /x/{id}`, `POST /x`, `PUT /x/{id}`, `DELETE /x/{id}` y las variantes por lotes `/x/lista` (POST, PUT, DELETE). A eso se suman las consultas específicas: `porFecha`, `porCentro`, `entreFechas`, `grupos`, `existeGrupo`, `diferencias/simples`, `diferencias/tablePdf`, `basicos`, `anualesBasicosPorFecha`, `virtualesBasicosPorFecha`, `diasCalendarioCrudos`, `marcarFestivos`, `ajustarJds`, `recalcularResumenes`, `regererarTodos`, `hastaMesEnAño`, `hastaNoviembreAñoAnterior`, `errores`, `dcsReclamados`, `dndsReclamados`, `estadisticas/conceptosMes`, `estadisticas/conceptosAño`, `estadisticas/asignacionGraficos`, `nominas/generar` y `nominas/recalcular`.
El catálogo completo de unos 130 endpoints está en `catalogo-api.md`.

## 7. Lo que falta por averiguar
1. **Fórmulas exactas** de CalculosService, NominasHelper, CalendarioUtils, Utils.ParseIncidencia y ProcesoGraficosService. Se sacarán analizando el IL de `Orion2.Shared.dll` y se describirán aquí en lenguaje natural antes de reimplementarlas.
2. **Portal web privado**: hay que entrar con una cuenta de trabajador.
3. **Significado de las siglas** de incidencia y reglas del convenio: hay que confirmarlo con alguien del sindicato.
4. **Migración de datos**: los datos actuales están en la base de datos de Azure. La vía más limpia es exportarlos con la API actual (`GET`) usando una cuenta de administrador, con un script que ejecute el propio usuario. Otra opción es pedir acceso al recurso de Azure, si la suscripción está a nombre de la organización.
5. **Valores numéricos** de las enumeraciones, necesarios para que los datos importados coincidan.

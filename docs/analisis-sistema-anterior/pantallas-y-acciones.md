### InformesView
commands: 
texts: 

### CalendariosViewModel
commands: volver, load, actualizar, cancelar, descartarCambios, añadirCalendario, añadirQuincenales, borrarCalendario, borrarTodosCalendarios, deshacerBorrar, ajustarJDsTodos, retrocedeMes, avanzaMes, cambiarFecha, verAnual, verVirtual, detalleCalendario, recalcularResumenes, marcarFestivosTodos, regenerarDia, regenerarTodos, mostrarPorTrabajador
texts: "Sin agrupar" | "Por categoría" | "Por situación" | "No existe un convenio válido para " | ". Crea uno para que los cálculos sean correctos." | "Vas a eliminar todos los calendarios ¿Quieres continuar?" | "Eliminando calendarios borrados" | "Esta función cambiará JD por DS o FN donde corresponda. ¿Quieres continuar?" | "Ajustando JDs" | "No se pueden añadir calendarios en todos los centros." | "No están puestos los festivos para este año. ¿Quieres continuar?" | "Parece que no están puestos todos los festivos para este centro. ¿Quieres continuar?" | "Añadiendo calendario " | "Guardando calendario" | "Recopilando matrículas fallidas" | "Los siguientes calendarios no se han añadido, por no contener un trabajador válido " | "Cargando calendarios" | "En estos momentos hay calendarios duplicados. " | "No se pueden añadir calendarios quincenales en todos los centros." | "Mes a mostrar" | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Vas a marcar los festivos de todos los calendarios. ¿Quieres continuar?" | "Marcando festivos" | "Vas a recalcular los resúmenes de todos los calendarios. ¿Quieres continuar?" | "Recalculando resúmenes" | "Vas a modificar los cuatro servicios del día " | "Esta acción puede provocar pérdida de datos en el servicio virtual ¿Quieres continuar?" | "Vas a modificar los tres servicios de todos los calendarios. Esta acción puede provocar pérdida de datos en los servicios virtuales ¿Quieres continuar?" | "Regenerando calendarios" | "Cargando calendarios anuales" | "Guardando calendario..." | "Cargando calendario..." | "Vas a modificar los tres servicios del día " | "Regenerando día" | "Cargando conductor"

### ConductoresViewModel
commands: volver, load, actualizar, descartarCambios, deleteConductor, deleteRegulacion, deshacerBorrarConductor, deshacerBorrarRegulacion, detallesConductor, añadirConductor, detallesRegulacion, añadirRegulacion, mostrarCalendarios
texts: "Borrar un conductor hará que se borren todos los datos asociados a este conductor (calendarios, reclamaciones, etc) ¿Estás seguro de borrar al conductor?" | "Sin agrupar" | "Por categoría" | "Por situación" | "Por centro" | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Guardando conductores nuevos" | "Actualizando conductores modificados" | "Eliminando conductores borrados" | "Cargando conductores"

### ConveniosViewModel
commands: volver, load, actualizar, descartarCambios, opcionesCentro, tablasSalariales, añadirConvenio, deleteConvenio, incrementarImportes
texts: "Incrementar importes" | "Introduce el porcentaje en el que se incrementarán los importes. También se incrementarán las tablas salariales y el plus viaje." | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Vas a borrar el convenio del año " | "Esta acción elimina todos los datos del convenio y no puede deshacerse. " | "¿Estás seguro?"

### GraficosViewModel
commands: volver, load, actualizar, cancelar, descartarCambios, deleteGrafico, deshacerBorrarGrafico, recalcularGraficos, deducirTurno, deducirDia, añadirGrafico, añadirGrupo, deleteGrupo, exportarGrupo, detalleGrafico
texts: "No existe un convenio para la validez de este grupo. Añada un convenio para poder recalcular los gráficos." | "No existe un convenio para la validez de este grupo. Añada un convenio para poder añadir gráficos." | "Sin Agrupar" | "Por Categoría" | "Por tipo día" | "Gráficos: " | "T1: " | "T2: " | "T3: " | "T4: " | "Trabajadas: " | "Acumuladas: " | "Nocturnas: " | "Sin gráficos" | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Guardando gráficos nuevos" | "Actualizando gráficos modificados" | "Eliminando gráficos borrados" | "Cargando gráficos" | "Cargando grupos de gráficos" | "Vas a borrar el grupo con fecha " | "Esta acción elimina todos los gráficos del grupo y no puede deshacerse. " | "¿Estás seguro?" | "Grupo de gráficos a exportar" | "Archivos JSON|*.json|Todos los archivos|*.*" | " - Graficos " | "No existe el archivo." | "Cargando grupos..."

### HerramientasViewModel
commands: volver, load, seleccionarHerramienta
texts: "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### InformesViewModel
commands: volver, load, seleccionarInforme
texts: "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando listado de conductores"

### LineasViewModel
commands: volver, load, actualizar, descartarCambios, deleteLinea, deshacerBorrarLineas, deleteItinerario, deshacerBorrarItinerarios, deleteParada, deshacerBorrarParadas, importarLineas, exportarLineas
texts: "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Líneas a exportar" | "Archivos JSON|*.json|Todos los archivos|*.*" | "Líneas e itinerarios.json" | "Líneas a importar" | "No existe el archivo."

### LoginViewModel
commands: login, opciones
texts: "Inicio de sesión" | "El usuario debe ser administrador para acceder a Mercurio." | "El usuario está bloqueado. Consulte con el administrador." | "Usuario bloqueado." | "Usuario o contraseña no válidos" | "Error interno del servidor"

### MainViewModel
commands: close, save, loggedUser
texts: "Usuario: " | "Sesión válida hasta las 0h del " | "¿Quieres cerrar la sesión?" | "Cerrar sesión" | "El sistema anterior - "

### NominasViewModel
commands: volver, load, actualizar, descartarCambios, borrarNomina, deshacerBorrarNominas, detalleNomina
texts: "Sin agrupar" | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando conductores" | "Cargando nóminas" | "Actualizando nómina cambiada" | "Eliminando nominas borradas"

### PrincipalViewModel
commands: load, conductores, graficos, calendarios, lineas, convenios, informes, reclamaciones, nominas, herramientas, opciones, superUser
texts: "Menú principal" | "No hay una API definida" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### ReclamacionesViewModel
commands: volver, load, actualizar, descartarCambios, añadirReclamacion, borrarReclamacion, deshacerBorrarReclamaciones, detalleReclamacion, marcarResuelta
texts: "Elije una fecha" | "Ya hay una reclamación con esa fecha. Elige otra." | "Sin agrupar" | "En curso" | "¿Quieres descartar los cambios?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando conductores" | "Cargando reclamaciones" | "Guardando reclamaciones nuevas" | "Actualizando reclamaciones modificadas" | "Eliminando reclamaciones borradas"

### UsuariosViewModel
commands: volver, load, recargarUsuarios, enviarEmail
texts: "Gestión de usuarios" | "No hay usuarios." | "Sin agrupar" | "Un usuario" | " usuarios" | "No hay usuarios" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando usuarios" | "Enviando email" | "MENSAJE ENVIADO" | "Se ha enviado el email correctamente"

### AsignacionGraficosViewModel
commands: generarInforme, crearPdf
texts: "Asignación de gráficos en calendarios" | "Asignación de gráficos" | "Este informe revisa día a día un mes de un centro en concreto y saca los datos siguientes: - Descansos realizados por día. - Gráficos que se deben realizar por día según el grupo de gráficos que corresponda. - De los gráficos anteriores, cuántos están asignados. - Listado de los gráficos que no se han asignado. - Listado de los gráficos que no están en el grupo de gráficos correspondiente, pero se realizan igualmente." | "Cargando asignaciones de gráficos..." | "Generando PDF..."

### CompararGruposGraficosViewModel
commands: compararGrupos, generarPdf
texts: "Comparar grupos de gráficos" | "Comparación de grupos de gráficos" | "Este informe permite ver las diferencias gráfico a gráfico que hay en dos grupos de gráficos diferentes. Nos muestra los gráficos que no existen en uno de los grupos, así como las diferencias, si las hay, en un gráfico que existe en ambos grupos." | "Cargando grupos de gráficos" | "Cargando grupos..." | "La reclamación no está en curso Es necesario que esté en curso para generar un PDF. ¿Quieres ponerla en curso?"

### ErroresCalendariosViewModel
commands: generarInforme, crearPdf
texts: "Errores en calendarios" | "Errores de calendario" | "Este informe lista todos los errores detectados en el calendario seleccionado." | "Generando PDF..." | "Cargando errores de calendario..."

### EstadisticasCalendariosViewModel
commands: 
texts: "Por conductor" | "Por gráficos" | "Estadísticas de calendarios"

### EstadisticasReclamacionesViewModel
commands: generarInforme
texts: "Estadísticas de reclamaciones" | "Este informe muestra un listado de todos los conceptos reclamados en el período indicado para un centro de trabajo determinado. Se puede ver por mes o todo el año. Se puede filtrar el tipo de trabajador al que afecta el informe. Finalmente se indican los totales reclamados." | "Cargando conceptos reclamados..."

### InformeViewModelBase
commands: retrocedeMes, avanzaMes, cambiarFecha, ayuda
texts: "Ayuda no disponible." | "Mes a mostrar" | "Guardando calendario..." | "Cargando calendario..."

### RealizacionGraficosViewModel
commands: 
texts: "Realización de los gráficos"

### CalendariosCrudosViewModel
commands: retrocedeMes, avanzaMes, cambiarFecha, crearExcel
texts: "Extraer calendarios crudos a un archivo de Excel" | "Mes a mostrar" | "Archivo de Excel" | "Abrir archivo" | "Extrayendo los días de los calendarios..." | "No se han encontrado calendarios para el período y centro seleccionados." | "Guardando calendario..." | "Cargando calendario..."

### ExtraerGraficosExcelArrasateViewModel
commands: cambiarFecha, borrarGrafico, borrarTodosGraficos, extraerGraficos
texts: "Extraer gráficos" | "Grupo de gráficos" | "Vas a borrar todos los gráficos. ¿Quieres continuar?" | "Mes a mostrar" | "No se pueden guardar gráficos para todos los centros." | "Ya existe un grupo con fecha " | " para el centro de " | "No has cambiado la fecha del grupo de gráficos. ‚¿Quieres continuar?" | "Generando gráficos" | "Guardando grupo de gráficos" | "Grupo creado" | "Se ha creado el grupo " | " con " | " gráficos. No olvides recalcular los gráficos antes de usarlos." | "Guardando calendario..." | "Cargando calendario..."

### ExtraerGraficosPdfViewModel
commands: nuevoArchivo, abrirArchivo, extraerDePdf, guardarArchivo, guardarComo, retrocedePagina, avanzaPagina, añadirPagina, eliminarPagina, procesar, detalleGrafico, cambiarFecha, guardarGrupos, borrarGrafico, borrarTodosGraficos
texts: "Extraer gráficos" | "Vas a eliminar esta página. ¿Deseas continuar?" | "Grupo de gráficos" | "Vas a borrar todos los gráficos generados. ¿Quieres continuar?" | "Mes a mostrar" | "Hay cambios sin guardar en el texto. ¿Deseas guardar el archivo antes?" | "Archivos de texto|*.txt|Todos los archivos|*.*" | "Abrir archivo de texto." | "Archivos PDF|*.pdf|Todos los archivos|*.*" | "Abrir archivo PDF." | "Guardar archivo de texto." | "No se pueden guardar gráficos para todos los centros." | "La fecha de algún gráfico no coincide con la fecha de grupo. Procesa los gráficos de nuevo." | "Ya existe un grupo con fecha " | " para el centro de " | "Se han creado los siguientes grupos de gráficos " | "No has cambiado la fecha del grupo de gráficos. ‚¿Quieres continuar?" | "Guardando calendario..." | "Cargando calendario..."

### AddCalendariosViewModel
commands: load, cancelar, aceptar, borrarCalendario, borrarTodosCalendarios, deshacerBorrarCalendarios
texts: "Añadir calendarios anuales" | "Añadir calendarios quincenales" | "Vas a eliminar todos los calendarios ¿Quieres continuar?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### AddConvenioViewModel
commands: load, salir, crear
texts: "Nuevo convenio" | "Ya existe un convenio con ese año de validez. Selecciona otro año." | "Debes elegir un convenio del que copiar el nuevo." | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### AddGraficoViewModel
commands: load, continuar, salir
texts: "Añadir gráficos" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### AddGrupoGraficosViewModel
commands: load, salir, crear, seleccionarArchivo
texts: "Nuevo grupo de gráficos" | "Ya existe un grupo con esa fecha de validez. Selecciona otra fecha." | "Grupo de gráficos a importar" | "Archivos JSON|*.json|Todos los archivos|*.*" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### AddItinerarioGraficoViewModel
commands: load, continuar, cerrar
texts: "Nuevo itinerario" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### CambiarFechaViewModel
commands: salir, aceptar
texts: 

### DetalleCalendarioViewModel
commands: volver, load, descartarCambios, detalleTrabajado, detalleAnual, detalleVirtual, verTotales, recalcularDia, recalcularCalendario, recalcularResumen, regenerarDia, regenerarCalendario, marcarFestivos, ajustarJDs, reclamar, generarNomina, regularDcs, retrocedeMes, avanzaMes, cambiarFecha
texts: "Detalle de calendario" | "Modificado por " | "dd-MM-yyyy HH:mm" | "Día " | " modificado por " | "Calendario cambiado. Resumen no válido." | "Recalculando día" | "Recalculando calendario" | "Sal del detalle de calendario y vuelve a entrar para que se reflejen los cambios." | "Mes a mostrar" | "Vas a modificar los cuatro servicios del día " | "Esta acción puede provocar pérdida de datos en el servicio virtual ¿Quieres continuar?" | "Guardando calendario..." | "Cargando calendario..." | "Cargando calendario" | "Cargando conductor" | "Cargando días externos" | "Cargando resúmenes" | "¿Quieres descartar los cambios realizados y cargar de nuevo el calendario?" | "Generando nómina" | "Ya hay una nómina generada. ¿Quieres volver a generarla?." | "Guardando cambios en el calendario" | "Generando reclamación" | "Hay una reclamación para este més que está resuelta. No se puede generar otra." | "Hay una reclamación para este més que está cerrada. No se puede generar otra." | "Importe plus de sábado" | "Importe plus de festivo" | "Importe plus de nocturnidad" | "Importe plus de nocturnidad parcial" | "Importe plus de paquetería" | "Importe plus de limpieza" | "Importe plus por menor descanso" | "Importe plus de Navidad" | "Importe plus de viaje" | "Importe quebranto de moneda" | "Importe refuerzos" | "Importe DNDs cobrados" | "DCs pendientes" | "DNDs pendientes" | "Horas acumuladas del día " | "Dieta de desayuno del día " | "Dieta de comida del día " | "Dieta de cena del día " | "Gráfico diferente el día " | "Total dietas = " | "Total pluses = " | "Total quebranto moneda = " | " IMPORTE TOTAL = " | " TOTAL HORAS = " | "Guardando reclamación generada" | "Vas a modificar los servicios de todos los días del calendario actual. Esta acción puede provocar pérdida de datos en el servicio virtual ¿Quieres continuar?" | "Regenerando calendario" | "Vas a modificar los tres servicios del día " | "Regenerando día" | "Regulando DCs" | "Ya existe una regulación de DCs para este año de " | " horas en " | " DCs. ¿Quieres eliminarla?" | "Regulación anual de DCs." | "Regulación de DCs"

### DetalleConceptoReclamadoViewModel
commands: cerrar, cambiaFecha
texts: "Detalle de concepto reclamado" | "Fecha del concepto" | "La fecha debe ser del mismo mes y año que la reclamación Elije otra fecha." | "Fecha de la reclamación" | "Ya existe una reclamación con fecha " | "MM - yyyy" | " Elije otra fecha."

### DetalleConductorViewModel
commands: load, ok, añadirReclamacion, borrarReclamacion, deshacerBorrarReclamaciones, detalleReclamacion
texts: "Detalle de trabajador" | "Sin agrupar" | "En curso" | "Elije una fecha" | "Ya hay una reclamación con esa fecha. Elige otra." | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando reclamaciones" | "Guardando reclamaciones nuevas" | "Actualizando reclamaciones modificadas" | "Eliminando reclamaciones borradas"

### DetalleDiaViewModel
commands: cerrar
texts: "Detalle de día" | " de "

### DetalleGraficoViewModel
commands: cerrar, añadirItinerario, deleteItinerario, deshacerBorrarItinerarios, calcularItinerarios, asignarTiempoPago
texts: "Detalle de gráfico" | "Descanso de " | " minutos." | "Pausa de " | "Disponibilidad de " | "Reserva de " | "Tiempo de partición de " | " Relevo en " | "No existe el itinerario " | " ¿Quieres continuar?" | "Itinerario desconocido."

### DetalleNominaViewModel
commands: cerrar, load, cambiarAntiguedad, cambiarPorcentajeIrpf
texts: "Detalle de Nómina" | "Nómina de " | "Sin período" | "Del " | " al " | " de " | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Nueva fecha de antigüedad" | "Recalculando nómina..." | "Porcentaje I.R.P.F." | "Introduce el nuevo porcentaje de I.R.P.F." | "Guardando nómina"

### DetalleReclamacionViewModel
commands: cerrar, cambiaFecha, cambiaFechaEfecto, añadirConcepto, borrarConcepto, deshacerBorrarConceptos, recalcularNotas, detalleConcepto, generarPdf
texts: "Detalle de reclamación" | "Fecha de efecto" | "Total dietas = " | "Total pluses = " | "Total quebranto moneda = " | "Total refuerzos = " | "Total otros importes = " | " IMPORTE TOTAL = " | " TOTAL HORAS = " | "Fecha de la reclamación" | "Ya existe una reclamación con fecha " | "MM - yyyy" | " Elije otra fecha." | "La reclamación no está en curso Es necesario que esté en curso para generar un PDF. ¿Quieres ponerla en curso?"

### DetalleRegulacionViewModel
commands: load, ok, cancel
texts: "Detalle de regulación" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### EnviarEmailViewModel
commands: load, cancelar, enviar, añadirUsuario, añadirTodos, añadirAfiliados, añadirAdmin, añadirSuper, quitarUsuario, quitarTodos, quitarAfiliados, quitarAdmin, quitarSuper
texts: "Enviar email" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### ErrorDialogViewModel
commands: ok
texts: "Error en "

### InputDialogViewModel
commands: ok
texts: "Debes escribir un número entero válido." | "Debes escribir un número decimal válido." | "Debes escribir una hora válida."

### MessageDialogViewModel
commands: ok, no
texts: 

### MostrarPorConductorViewModel
commands: volver, load, recargar, retrocedeAño, avanzaAño, detalleCalendario
texts: "Calendarios por conductor" | "Cargando calendarios" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores." | "Cargando conductor"

### OpcionesCentroViewModel
commands: load, cerrar, añadirFestivo, borrarFestivo, deshacerBorrarFestivo, propagarFestivos
texts: "Opciones de " | "Ya existe un festivo con esa fecha" | "Los festivos actuales de los otros centros serán eliminados ¿Quieres continuar?" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### OpcionesViewModel
commands: load, cerrar, path, file
texts: "Seleccione un archivo." | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### TablasSalarialesViewModel
commands: load, cerrar
texts: "Tablas salariales" | "Tablas salariales " | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### TotalesCalendarioViewModel
commands: load, volver
texts: "Totales de calendario" | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### VerAnualesViewModel
commands: load, volver
texts: "Visualización de calendarios" | "ANUALES - " | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### VerVirtualesViewModel
commands: load, volver
texts: "Visualización de calendarios" | "VIRTUALES - " | "Aún no se ha creado el convenio del año " | ". Igual es hora de crearlo ya para evitar problemas posteriores."

### ApiService
commands: 
texts: "Vas a recalcular los resúmenes de todos los calendarios. ¿Quieres continuar?" | "Recalculando resúmenes" | "Vas a modificar los tres servicios de todos los calendarios. Esta acción puede provocar pérdida de datos en los servicios virtuales ¿Quieres continuar?" | "Regenerando calendarios" | "El usuario debe ser administrador para acceder a Mercurio." | "El usuario está bloqueado. Consulte con el administrador." | "Usuario bloqueado." | "Usuario o contraseña no válidos" | "Error interno del servidor"

### ConfigService
commands: 
texts: 

### ExcelService
commands: 
texts: "Reducción jornada" | "Es festivo" | "Categoría gráfico" | "Tipo día" | "Inicio partido" | "Final partido" | "Tiempo total" | "Tiempo partido" | "Trabajadas convenio" | "Tiempo vacío" | "Tiene paquetería" | "Plus paquetería" | "Facturado paquetería" | "Plus menor descanso" | "Dnd cobrado" | "Dnds cobrados por descanso"

### IApiService
commands: 
texts: "Vas a recalcular los resúmenes de todos los calendarios. ¿Quieres continuar?" | "Recalculando resúmenes" | "Vas a modificar los tres servicios de todos los calendarios. Esta acción puede provocar pérdida de datos en los servicios virtuales ¿Quieres continuar?" | "Regenerando calendarios" | "El usuario debe ser administrador para acceder a Mercurio." | "El usuario está bloqueado. Consulte con el administrador." | "Usuario bloqueado." | "Usuario o contraseña no válidos" | "Error interno del servidor"

### IConfigService
commands: 
texts: 

### IExcelService
commands: 
texts: 

### IPdfService
commands: 
texts: 

### IProcesoGraficosService
commands: 
texts: 

### IQuestPdfService
commands: 
texts: 

### PdfService
commands: 
texts: "AnderSoft - el sistema anterior" | "El sistema anterior" | "RECLAMACIÓN DE CONCEPTOS" | "Centro: " | "Trabajador/a: " | "CONCEPTOS A RECLAMAR" | " (Gráf. " | "Página " | "MMMM yyyy" | "Nº Reclamación: " | "dd - MM - yyyy" | "El/la trabajador/a"

### ProcesoGraficosService
commands: 
texts: "([0-1]?[0-9]|2[0-3]):[0-5][0-9] a ([0-1]?[0-9]|2[0-3]):[0-5][0-9]" | "^Reserva de ([0-1]?[0-9]|2[0-3]):[0-5][0-9] ([0-1]?[0-9]|2[0-3]):[0-5][0-9]$" | "Reserva de " | " Reserva"

### QuestPdfService
commands: 
texts: 

### InformeAsignacionGraficosDocument
commands: 
texts: "Gráficos no asignados" | "Gráficos inexistentes"

### InformeCompararGruposGraficos
commands: 
texts: "Plus cena"

### InformeDocument
commands: 
texts: "Página "

### InformeErroresCalendario
commands: 
texts: 

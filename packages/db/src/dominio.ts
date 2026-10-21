/**
 * Puente BD ↔ dominio: convierte filas del esquema Postgres en objetos de
 * `@mercurio/domain` (minutos desde medianoche, céntimos) y devuelve las
 * columnas para guardar los resultados de los cálculos.
 *
 * Los escritores devuelven objetos con claves LITERALES: las claves
 * calculadas con el prefijo en tiempo de ejecución rompen `$inferInsert`
 * de drizzle (los tres spreads `Trabajado*` colisionan y pierden campos).
 */
import type {
  Calendario, Conductor, Convenio, DiaCalendario, OpcionesCentro, Reclamacion,
  Regulacion, ResumenCalendario, Servicio, TablaSalarial,
} from "@mercurio/domain";
import {
  CodigoIncidencia, Incidencia, TipoDia, Turno, TipoReclamacion,
} from "@mercurio/domain";
import type { InferSelectModel } from "drizzle-orm";
import {
  calendarios, conceptosReclamados, conductores, convenios, diasCalendario,
  festivos, opcionesCentro, regulaciones, resumenes, tablasSalariales,
} from "./schema";
import { aCentimos, aIntervalo, aMinutos, aNumero, aNumerico, aTextoNumerico } from "./convertir";

/** Filas del esquema (las alias de `index.ts`, visibles aquí con otro nombre). */
type FilaCalendario = InferSelectModel<typeof calendarios>;
type FilaConductor = InferSelectModel<typeof conductores>;
type FilaConvenio = InferSelectModel<typeof convenios>;
type FilaDia = InferSelectModel<typeof diasCalendario>;
type FilaFestivo = InferSelectModel<typeof festivos>;
type FilaOpcionesCentro = InferSelectModel<typeof opcionesCentro>;
type FilaRegulacion = InferSelectModel<typeof regulaciones>;
type FilaResumen = InferSelectModel<typeof resumenes>;
type FilaTablaSalarial = InferSelectModel<typeof tablasSalariales>;
type FilaConcepto = InferSelectModel<typeof conceptosReclamados>;

/** Fecha sentinel de los conceptos mensuales (DateTime.MinValue del original). */
const FECHA_MINIMA = "0001-01-01 00:00:00";

// ---- Lectura: filas → dominio ----

type PrefijoServicio = "Anual" | "Trabajado" | "Virtual";

/** `interval` nullable → minutos (o null). */
function vueltaNulo(intervalo: string | null): number | null {
  return intervalo === null ? null : aMinutos(intervalo);
}

/** Bloque de servicio de la fila ("Anual…", "Trabajado…" o "Virtual…") → Servicio. */
export function servicioDesdeFila(fila: FilaDia, prefijo: PrefijoServicio): Servicio {
  const p = prefijo;
  return {
    incidencia: fila[`${p}Incidencia`] as Incidencia,
    codigo: fila[`${p}Codigo`] as CodigoIncidencia,
    plusPaqueteria: aCentimos(fila[`${p}PlusPaqueteria`]),
    facturadoPaqueteria: aCentimos(fila[`${p}FacturadoPaqueteria`]),
    limpieza: aNumero(fila[`${p}Limpieza`]),
    plusMenorDescanso: aCentimos(fila[`${p}PlusMenorDescanso`]),
    noCalcular: fila[`${p}NoCalcular`],
    categoria: fila[`${p}Categoria`],
    numero: fila[`${p}Numero`],
    tipoDia: fila[`${p}TipoDia`] as TipoDia,
    turno: fila[`${p}Turno`] as Turno,
    inicio: vueltaNulo(fila[`${p}Inicio`]),
    final: vueltaNulo(fila[`${p}Final`]),
    inicioPartido: vueltaNulo(fila[`${p}InicioPartido`]),
    finalPartido: vueltaNulo(fila[`${p}FinalPartido`]),
    valoracion: aMinutos(fila[`${p}Valoracion`]),
    tiempoTotal: aMinutos(fila[`${p}TiempoTotal`]),
    tiempoPartido: aMinutos(fila[`${p}TiempoPartido`]),
    trabajadas: aMinutos(fila[`${p}Trabajadas`]),
    trabajadasConvenio: aMinutos(fila[`${p}TrabajadasConvenio`]),
    tiempoVacio: aMinutos(fila[`${p}TiempoVacio`]),
    acumuladas: aMinutos(fila[`${p}Acumuladas`]),
    nocturnas: aMinutos(fila[`${p}Nocturnas`]),
    desayuno: aNumero(fila[`${p}Desayuno`]),
    comida: aNumero(fila[`${p}Comida`]),
    cena: aNumero(fila[`${p}Cena`]),
    tienePlusPaqueteria: fila[`${p}TienePlusPaqueteria`],
  };
}

/** Fila de día → DiaCalendario del dominio (fecha "YYYY-MM-DD"). */
export function diaDesdeFila(fila: FilaDia): DiaCalendario {
  return {
    id: fila.id,
    calendarioId: fila.calendarioId,
    fecha: fila.fecha.slice(0, 10),
    esFestivo: fila.esFestivo,
    servicioAnual: servicioDesdeFila(fila, "Anual"),
    servicioTrabajado: servicioDesdeFila(fila, "Trabajado"),
    servicioVirtual: servicioDesdeFila(fila, "Virtual"),
    notas: fila.notas,
    vehiculos: fila.vehiculos,
    refuerzos: fila.refuerzos,
    dndCobrado: fila.dndCobrado,
    dndsCobradosPorDescanso: aCentimos(fila.dndsCobradosPorDescanso),
    isRemoteUpdated: fila.isRemoteUpdated,
  };
}

/** Fila de resumen → ResumenCalendario del dominio (horas en minutos, dinero en céntimos). */
export function resumenDesdeFila(fila: FilaResumen): ResumenCalendario {
  return {
    id: fila.id,
    calendarioId: fila.calendarioId,
    diasActivo: fila.diasActivo,
    diasInactivo: fila.diasInactivo,
    diasTrabajo: fila.diasTrabajo,
    diasTrabajoJD: fila.diasTrabajoJD,
    diasTrabajoFN: fila.diasTrabajoFN,
    diasOV: fila.diasOV,
    diasJD: fila.diasJD,
    diasFN: fila.diasFN,
    diasE: fila.diasE,
    diasDS: fila.diasDS,
    diasDC: fila.diasDC,
    diasF6: fila.diasF6,
    diasF6D: fila.diasF6D,
    diasDND: fila.diasDND,
    diasDF: fila.diasDF,
    diasPER: fila.diasPER,
    diasEJD: fila.diasEJD,
    diasEFN: fila.diasEFN,
    diasOVJD: fila.diasOVJD,
    diasOVFN: fila.diasOVFN,
    diasF6DC: fila.diasF6DC,
    diasFOR: fila.diasFOR,
    diasFORJD: fila.diasFORJD,
    diasFORFN: fila.diasFORFN,
    diasOVA: fila.diasOVA,
    diasOVAJD: fila.diasOVAJD,
    diasOVAFN: fila.diasOVAFN,
    diasLAC: fila.diasLAC,
    diasLACJD: fila.diasLACJD,
    diasLACFN: fila.diasLACFN,
    diasCO: fila.diasCO,
    diasCE: fila.diasCE,
    diasRE: fila.diasRE,
    diasHorasSindicales: fila.diasHorasSindicales,
    diasComiteJD: fila.diasComiteJD,
    diasComiteDC: fila.diasComiteDC,
    sabadosTrabajados: fila.sabadosTrabajados,
    sabadosDescansados: fila.sabadosDescansados,
    domingosTrabajados: fila.domingosTrabajados,
    domingosDescansados: fila.domingosDescansados,
    festivosTrabajados: fila.festivosTrabajados,
    festivosDescansados: fila.festivosDescansados,
    diasTurno1: fila.diasTurno1,
    diasTurno2: fila.diasTurno2,
    diasTurno3: fila.diasTurno3,
    diasTurno4: fila.diasTurno4,
    diasConRefuerzo: fila.diasConRefuerzo,
    findesCompletos: aNumero(fila.findesCompletos),
    diasDeberiaTrabajar: aNumero(fila.diasDeberiaTrabajar),
    diasDeberiaDescansar: aNumero(fila.diasDeberiaDescansar),
    diasDeberiaVacaciones: aNumero(fila.diasDeberiaVacaciones),
    horasTrabajadas: aMinutos(fila.horasTrabajadas),
    horasTrabajadasConvenio: aMinutos(fila.horasTrabajadasConvenio),
    horasAcumuladas: aMinutos(fila.horasAcumuladas),
    horasAcumuladasVirtual: aMinutos(fila.horasAcumuladasVirtual),
    horasNocturnas: aMinutos(fila.horasNocturnas),
    desayunos: aNumero(fila.desayunos),
    desayunosVirtual: aNumero(fila.desayunosVirtual),
    comidas: aNumero(fila.comidas),
    comidasVirtual: aNumero(fila.comidasVirtual),
    cenas: aNumero(fila.cenas),
    cenasVirtual: aNumero(fila.cenasVirtual),
    importeDietas: aCentimos(fila.importeDietas),
    importeDietasVirtual: aCentimos(fila.importeDietasVirtual),
    totalDietas: aNumero(fila.totalDietas),
    totalDietasVirtual: aNumero(fila.totalDietasVirtual),
    diasConPlusPaqueteria: fila.diasConPlusPaqueteria,
    facturadoPaqueteria: aCentimos(fila.facturadoPaqueteria),
    plusesPaqueteria: aCentimos(fila.plusesPaqueteria),
    plusesMenorDescanso: aCentimos(fila.plusesMenorDescanso),
    limpiezas: aNumero(fila.limpiezas),
    totalLimpiezas: aNumero(fila.totalLimpiezas),
    importePlusSabados: aCentimos(fila.importePlusSabados),
    importePlusFestivos: aCentimos(fila.importePlusFestivos),
    importePlusPaqueteria: aCentimos(fila.importePlusPaqueteria),
    importePlusLimpieza: aCentimos(fila.importePlusLimpieza),
    importePlusMenorDescanso: aCentimos(fila.importePlusMenorDescanso),
    importePlusNocturnidad: aCentimos(fila.importePlusNocturnidad),
    importePlusNocturnidadParcial: aCentimos(fila.importePlusNocturnidadParcial),
    importePlusNavidad: aCentimos(fila.importePlusNavidad),
    importePlusViaje: aCentimos(fila.importePlusViaje),
    importeQuebrantoMoneda: aCentimos(fila.importeQuebrantoMoneda),
    importeVariableVacaciones: aCentimos(fila.importeVariableVacaciones),
    importeRefuerzos: aCentimos(fila.importeRefuerzos),
    errores: fila.errores,
    totalDndsCobrados: fila.totalDndsCobrados,
    importeDndsCobrados: aCentimos(fila.importeDndsCobrados),
    totalDndsCobradosPorDescanso: aCentimos(fila.totalDndsCobradosPorDescanso),
    importeDndsCobradosPorDescanso: aCentimos(fila.importeDndsCobradosPorDescanso),
  } satisfies ResumenCalendario;
}

/**
 * Fila de calendario + días + resumen (+ conductor del dominio) → Calendario.
 * Los importes `Total*` llegan en céntimos; TotalDcsPendientes y
 * TotalDndsPendientes guardan UNIDADES de días (no son dinero) y se leen tal cual.
 */
export function calendarioDesdeFila(
  fila: FilaCalendario,
  filasDias: FilaDia[],
  resumen: ResumenCalendario | null,
  conductor: Conductor | null,
): Calendario {
  return {
    id: fila.id,
    conductorId: fila.conductorId,
    conductor,
    centro: fila.centro,
    fecha: fila.fecha.slice(0, 10),
    resumen,
    dias: filasDias.map(diaDesdeFila),
    totalImportePlusSabados: aCentimos(fila.totalImportePlusSabados),
    totalImportePlusFestivos: aCentimos(fila.totalImportePlusFestivos),
    totalImportePlusNocturnidad: aCentimos(fila.totalImportePlusNocturnidad),
    totalImportePlusNocturnidadParcial: aCentimos(fila.totalImportePlusNocturnidadParcial),
    totalImportePlusPaqueteria: aCentimos(fila.totalImportePlusPaqueteria),
    totalImportePlusLimpieza: aCentimos(fila.totalImportePlusLimpieza),
    totalImportePlusMenorDescanso: aCentimos(fila.totalImportePlusMenorDescanso),
    totalImportePlusNavidad: aCentimos(fila.totalImportePlusNavidad),
    totalImportePlusViaje: aCentimos(fila.totalImportePlusViaje),
    totalQuebrantoMoneda: aCentimos(fila.totalQuebrantoMoneda),
    totalRefuerzos: aCentimos(fila.totalRefuerzos),
    totalImporteDietas: aCentimos(fila.totalImporteDietas),
    totalDcsPendientes: aNumero(fila.totalDcsPendientes),
    totalDndsPendientes: aNumero(fila.totalDndsPendientes),
    totalImporteDndsCobrados: aCentimos(fila.totalImporteDndsCobrados),
  };
}

/** Fila de conductor + regulaciones → Conductor del dominio. */
export function conductorDesdeFila(fila: FilaConductor, regulaciones: FilaRegulacion[]): Conductor {
  return {
    id: fila.id,
    matricula: fila.matricula,
    nombre: fila.nombre,
    apellidos: fila.apellidos,
    centro: fila.centro,
    categoria: fila.categoria,
    situacion: fila.situacion,
    fechaAntiguedad: fila.fechaAntiguedad.slice(0, 10),
    porcentajeIrpf: aNumero(fila.porcentajeIrpf),
    acumuladasIniciales: aMinutos(fila.acumuladasIniciales),
    dcsIniciales: aNumero(fila.dcsIniciales),
    dndsIniciales: aNumero(fila.dndsIniciales),
    regulaciones: regulaciones.map((r): Regulacion => ({
      id: r.id,
      conductorId: r.conductorId,
      tipoRegulacion: r.tipo,
      fecha: r.fecha.slice(0, 10),
      horas: aMinutos(r.horas),
      dcs: aNumero(r.dcs),
      dnds: aNumero(r.dnds),
      motivo: r.motivo,
    })),
  };
}

/** Fila de convenio + opciones/festivos/tablas → Convenio del dominio. */
export function convenioDesdeFilas(
  fila: FilaConvenio,
  filasOpciones: FilaOpcionesCentro[],
  filasFestivos: FilaFestivo[],
  filasTablas: FilaTablaSalarial[],
): Convenio {
  const opciones: OpcionesCentro[] = filasOpciones.map((o) => ({
    id: o.id,
    centro: o.centro,
    numerosL: o.numerosL,
    numerosV: o.numerosV,
    numerosS: o.numerosS,
    numerosF: o.numerosF,
    numerosR: o.numerosR,
    limpiezasMes: o.limpiezasMes,
    pagarPlusViaje: o.pagarPlusViaje,
    importePlusViaje: aCentimos(o.importePlusViaje),
    festivos: filasFestivos
      .filter((f) => f.opcionesCentroId === o.id)
      .map((f) => ({ id: f.id, fecha: f.fecha.slice(0, 10) })),
  }));
  const tablas: TablaSalarial[] = filasTablas.map((t) => ({
    id: t.id,
    categoria: t.categoria,
    sueldoBaseDiario: aCentimos(t.sueldoBaseDiario),
    sueldoBaseMensual: aCentimos(t.sueldoBaseMensual),
    sueldoBaseAnual: aCentimos(t.sueldoBaseAnual),
    complementoSalarial: aCentimos(t.complementoSalarial),
    baseAntiguedad: aCentimos(t.baseAntiguedad),
    precioHoraExtra: aCentimos(t.precioHoraExtra),
    precioQuebrantoMoneda: aCentimos(t.precioQuebrantoMoneda),
    pagaSeptiembre: aCentimos(t.pagaSeptiembre),
    importeDndCobrado: aCentimos(t.importeDndCobrado),
    seguroAccidentes: aCentimos(t.seguroAccidentes),
    porcentajeSeguridadSocial: aNumero(t.porcentajeSeguridadSocial),
    porcentajeDesempleo: aNumero(t.porcentajeDesempleo),
  }));
  return {
    año: fila.año,
    jornadaMedia: aMinutos(fila.jornadaMedia),
    importeDietas: aCentimos(fila.importeDietas),
    jornadaAnual: fila.jornadaAnual,
    diasTrabajoAnuales: fila.diasTrabajoAnuales,
    diasDescansoAnuales: fila.diasDescansoAnuales,
    descansosSueltosAnuales: fila.descansosSueltosAnuales,
    diasVacacionesAnuales: fila.diasVacacionesAnuales,
    findesCompletosAnuales: fila.findesCompletosAnuales,
    diasTrabajadosSeguidos: fila.diasTrabajadosSeguidos,
    descansosSueltosMes: fila.descansosSueltosMes,
    minimoDescansosMes: fila.minimoDescansosMes,
    maximoDescansosMes: fila.maximoDescansosMes,
    maximoFindesSeguidos: fila.maximoFindesSeguidos,
    jornadaMaxima: aMinutos(fila.jornadaMaxima),
    jornadaMaximaFindes: aMinutos(fila.jornadaMaximaFindes),
    jornadaMaximaPartida: aMinutos(fila.jornadaMaximaPartida),
    tiempoPartidoMaximo: aMinutos(fila.tiempoPartidoMaximo),
    inicioNocturnas: aMinutos(fila.inicioNocturnas),
    finalNocturnas: aMinutos(fila.finalNocturnas),
    limiteDesayuno: aMinutos(fila.limiteDesayuno),
    inicioComidaContinuo: aMinutos(fila.inicioComidaContinuo),
    finalComidaContinuo: aMinutos(fila.finalComidaContinuo),
    inicioComidaPartido: aMinutos(fila.inicioComidaPartido),
    finalComidaPartido: aMinutos(fila.finalComidaPartido),
    inicioCena: aMinutos(fila.inicioCena),
    finalCena: aMinutos(fila.finalCena),
    limitePlusCena: aMinutos(fila.limitePlusCena),
    porcentajeDesayuno: fila.porcentajeDesayuno,
    porcentajePlusCena: fila.porcentajePlusCena,
    maximoLimpiezas: fila.maximoLimpiezas,
    importePlusFestivos: aCentimos(fila.importePlusFestivos),
    importePlusSabados: aCentimos(fila.importePlusSabados),
    importePlusMenorDescanso: aCentimos(fila.importePlusMenorDescanso),
    importePlusLimpieza: aCentimos(fila.importePlusLimpieza),
    importePlusPaqueteria: aCentimos(fila.importePlusPaqueteria),
    importePlusNocturnidad: aCentimos(fila.importePlusNocturnidad),
    importePlusNocturnidadDiario: aCentimos(fila.importePlusNocturnidadDiario),
    importePlusNavidad: aCentimos(fila.importePlusNavidad),
    importeRefuerzos: aCentimos(fila.importeRefuerzos),
    opcionesCentro: opciones,
    tablasSalariales: tablas,
  };
}

interface ReclamacionFila {
  id: number;
  conductorId: number;
  fecha: string;
  fechaEfecto: string;
  codigo: string | null;
  notas: string | null;
  notaInterna: string | null;
  cerrada: boolean;
}

/** Fila de reclamación + sus conceptos filas → Reclamación del dominio. */
export function reclamacionDesdeFilas(fila: ReclamacionFila, filas: FilaConcepto[]): Reclamacion {
  return {
    id: fila.id,
    conductorId: fila.conductorId,
    fecha: fila.fecha.slice(0, 10),
    fechaEfecto: fila.fechaEfecto.slice(0, 19).replace("T", " "),
    codigo: fila.codigo,
    notas: fila.notas,
    notaInterna: fila.notaInterna,
    cerrada: fila.cerrada,
    conceptosReclamados: filas.map((c) => ({
      id: c.id,
      reclamacionId: c.reclamacionId,
      fecha: c.fecha.slice(0, 10) === FECHA_MINIMA.slice(0, 10) ? "" : c.fecha.slice(0, 10),
      tipo: c.tipo as TipoReclamacion,
      descripcion: c.descripcion,
      graficoTrabajado: c.graficoTrabajado,
      horasReales: aMinutos(c.horasReales),
      horasCobradas: aMinutos(c.horasCobradas),
      importeReal: aNumero(c.importeReal),
      importeCobrado: aNumero(c.importeCobrado),
      incidenciasReales: c.incidenciasReales,
      incidenciasCobradas: c.incidenciasCobradas,
      importeTotal: aNumero(c.importeTotal),
      resuelto: false,
    })),
  };
}

// ---- Escritura: dominio → columnas de la BD ----

/**
 * Columnas del servicio TRABAJADO a partir de un Servicio del dominio
 * (tras recalcular). Todas las claves son literales.
 */
type ColumnasServicio = Pick<
  typeof diasCalendario.$inferInsert,
  | "TrabajadoIncidencia" | "TrabajadoCodigo" | "TrabajadoNoCalcular"
  | "TrabajadoCategoria" | "TrabajadoNumero" | "TrabajadoTipoDia" | "TrabajadoTurno"
  | "TrabajadoInicio" | "TrabajadoFinal" | "TrabajadoInicioPartido" | "TrabajadoFinalPartido"
  | "TrabajadoValoracion" | "TrabajadoTiempoTotal" | "TrabajadoTiempoPartido"
  | "TrabajadoTrabajadas" | "TrabajadoTrabajadasConvenio"
  | "TrabajadoTiempoVacio" | "TrabajadoAcumuladas" | "TrabajadoNocturnas"
  | "TrabajadoDesayuno" | "TrabajadoComida" | "TrabajadoCena"
  | "TrabajadoPlusPaqueteria" | "TrabajadoFacturadoPaqueteria"
  | "TrabajadoLimpieza" | "TrabajadoPlusMenorDescanso" | "TrabajadoTienePlusPaqueteria"
>;

export function servicioTrabajadoAColumnas(s: Servicio): ColumnasServicio {
  return {
    TrabajadoIncidencia: s.incidencia,
    TrabajadoCodigo: s.codigo,
    TrabajadoNoCalcular: s.noCalcular,
    TrabajadoCategoria: s.categoria,
    TrabajadoNumero: s.numero,
    TrabajadoTipoDia: s.tipoDia,
    TrabajadoTurno: s.turno,
    TrabajadoInicio: s.inicio === null ? null : aIntervalo(s.inicio),
    TrabajadoFinal: s.final === null ? null : aIntervalo(s.final),
    TrabajadoInicioPartido: s.inicioPartido === null ? null : aIntervalo(s.inicioPartido),
    TrabajadoFinalPartido: s.finalPartido === null ? null : aIntervalo(s.finalPartido),
    TrabajadoValoracion: aIntervalo(s.valoracion),
    TrabajadoTiempoTotal: aIntervalo(s.tiempoTotal),
    TrabajadoTiempoPartido: aIntervalo(s.tiempoPartido),
    TrabajadoTrabajadas: aIntervalo(s.trabajadas),
    TrabajadoTrabajadasConvenio: aIntervalo(s.trabajadasConvenio),
    TrabajadoTiempoVacio: aIntervalo(s.tiempoVacio),
    TrabajadoAcumuladas: aIntervalo(s.acumuladas),
    TrabajadoNocturnas: aIntervalo(s.nocturnas),
    TrabajadoDesayuno: aTextoNumerico(s.desayuno),
    TrabajadoComida: aTextoNumerico(s.comida),
    TrabajadoCena: aTextoNumerico(s.cena),
    TrabajadoPlusPaqueteria: aNumerico(s.plusPaqueteria),
    TrabajadoFacturadoPaqueteria: aNumerico(s.facturadoPaqueteria),
    TrabajadoLimpieza: aTextoNumerico(s.limpieza),
    TrabajadoPlusMenorDescanso: aNumerico(s.plusMenorDescanso),
    TrabajadoTienePlusPaqueteria: s.tienePlusPaqueteria,
  };
}

/**
 * Todas las columnas del resumen a partir del objeto del dominio (tras
 * recalcularResumen). Los campos del dominio y de la fila comparten nombre;
 * cambia la conversión por tipo: horas → intervalo, dinero → euros,
 * unidades → decimales.
 */
export function resumenAFila(
  r: ResumenCalendario,
): Omit<typeof resumenes.$inferInsert, "id" | "modifiedDate" | "modifiedBy"> {
  const f: Omit<typeof resumenes.$inferInsert, "id" | "modifiedDate" | "modifiedBy"> = {
    calendarioId: r.calendarioId ?? 0,
    diasActivo: r.diasActivo,
    diasInactivo: r.diasInactivo,
    diasTrabajo: r.diasTrabajo,
    diasTrabajoJD: r.diasTrabajoJD,
    diasTrabajoFN: r.diasTrabajoFN,
    diasOV: r.diasOV,
    diasJD: r.diasJD,
    diasFN: r.diasFN,
    diasE: r.diasE,
    diasDS: r.diasDS,
    diasDC: r.diasDC,
    diasF6: r.diasF6,
    diasF6D: r.diasF6D,
    diasDND: r.diasDND,
    diasDF: r.diasDF,
    diasPER: r.diasPER,
    diasEJD: r.diasEJD,
    diasEFN: r.diasEFN,
    diasOVJD: r.diasOVJD,
    diasOVFN: r.diasOVFN,
    diasF6DC: r.diasF6DC,
    diasFOR: r.diasFOR,
    diasFORJD: r.diasFORJD,
    diasFORFN: r.diasFORFN,
    diasOVA: r.diasOVA,
    diasOVAJD: r.diasOVAJD,
    diasOVAFN: r.diasOVAFN,
    diasLAC: r.diasLAC,
    diasLACJD: r.diasLACJD,
    diasLACFN: r.diasLACFN,
    diasCO: r.diasCO,
    diasCE: r.diasCE,
    diasRE: r.diasRE,
    diasHorasSindicales: r.diasHorasSindicales,
    diasComiteJD: r.diasComiteJD,
    diasComiteDC: r.diasComiteDC,
    sabadosTrabajados: r.sabadosTrabajados,
    sabadosDescansados: r.sabadosDescansados,
    domingosTrabajados: r.domingosTrabajados,
    domingosDescansados: r.domingosDescansados,
    festivosTrabajados: r.festivosTrabajados,
    festivosDescansados: r.festivosDescansados,
    diasTurno1: r.diasTurno1,
    diasTurno2: r.diasTurno2,
    diasTurno3: r.diasTurno3,
    diasTurno4: r.diasTurno4,
    diasConRefuerzo: r.diasConRefuerzo,
    findesCompletos: aTextoNumerico(r.findesCompletos),
    diasDeberiaTrabajar: aTextoNumerico(r.diasDeberiaTrabajar),
    diasDeberiaDescansar: aTextoNumerico(r.diasDeberiaDescansar),
    diasDeberiaVacaciones: aTextoNumerico(r.diasDeberiaVacaciones),
    horasTrabajadas: aIntervalo(r.horasTrabajadas),
    horasTrabajadasConvenio: aIntervalo(r.horasTrabajadasConvenio),
    horasAcumuladas: aIntervalo(r.horasAcumuladas),
    horasAcumuladasVirtual: aIntervalo(r.horasAcumuladasVirtual),
    horasNocturnas: aIntervalo(r.horasNocturnas),
    desayunos: aTextoNumerico(r.desayunos),
    desayunosVirtual: aTextoNumerico(r.desayunosVirtual),
    comidas: aTextoNumerico(r.comidas),
    comidasVirtual: aTextoNumerico(r.comidasVirtual),
    cenas: aTextoNumerico(r.cenas),
    cenasVirtual: aTextoNumerico(r.cenasVirtual),
    totalDietas: aTextoNumerico(r.totalDietas),
    totalDietasVirtual: aTextoNumerico(r.totalDietasVirtual),
    diasConPlusPaqueteria: r.diasConPlusPaqueteria,
    facturadoPaqueteria: aNumerico(r.facturadoPaqueteria),
    plusesPaqueteria: aNumerico(r.plusesPaqueteria),
    plusesMenorDescanso: aNumerico(r.plusesMenorDescanso),
    limpiezas: aTextoNumerico(r.limpiezas),
    totalLimpiezas: aTextoNumerico(r.totalLimpiezas),
    importeDietas: aNumerico(r.importeDietas),
    importeDietasVirtual: aNumerico(r.importeDietasVirtual),
    importePlusSabados: aNumerico(r.importePlusSabados),
    importePlusFestivos: aNumerico(r.importePlusFestivos),
    importePlusPaqueteria: aNumerico(r.importePlusPaqueteria),
    importePlusLimpieza: aNumerico(r.importePlusLimpieza),
    importePlusMenorDescanso: aNumerico(r.importePlusMenorDescanso),
    importePlusNocturnidad: aNumerico(r.importePlusNocturnidad),
    importePlusNocturnidadParcial: aNumerico(r.importePlusNocturnidadParcial),
    importePlusNavidad: aNumerico(r.importePlusNavidad),
    importePlusViaje: aNumerico(r.importePlusViaje),
    importeQuebrantoMoneda: aNumerico(r.importeQuebrantoMoneda),
    importeVariableVacaciones: aNumerico(r.importeVariableVacaciones),
    importeRefuerzos: aNumerico(r.importeRefuerzos),
    errores: r.errores,
    totalDndsCobrados: r.totalDndsCobrados,
    importeDndsCobrados: aNumerico(r.importeDndsCobrados),
    totalDndsCobradosPorDescanso: aTextoNumerico(r.totalDndsCobradosPorDescanso),
    importeDndsCobradosPorDescanso: aNumerico(r.importeDndsCobradosPorDescanso),
  };
  return f;
}

/**
 * Filas de conceptos a insertar desde la reclamación del dominio. Las
 * fechas "" (importes mensuales/pendientes) se convierten a la sentinel;
 * los conceptos pendientes de DCs/DNDs guardan unidades tal cual.
 */
export function conceptosAFilas(
  r: Reclamacion,
): Omit<typeof conceptosReclamados.$inferInsert, "id" | "modifiedDate" | "modifiedBy">[] {
  return r.conceptosReclamados.map((c) => ({
    reclamacionId: r.id ?? 0,
    fecha: c.fecha === "" ? FECHA_MINIMA : `${c.fecha} 00:00:00`,
    tipo: c.tipo,
    descripcion: c.descripcion,
    graficoTrabajado: c.graficoTrabajado,
    horasReales: aIntervalo(c.horasReales),
    horasCobradas: aIntervalo(c.horasCobradas),
    importeReal: aTextoNumerico(c.importeReal),
    importeCobrado: aTextoNumerico(c.importeCobrado),
    incidenciasReales: c.incidenciasReales,
    incidenciasCobradas: c.incidenciasCobradas,
    importeTotal: aTextoNumerico(c.importeTotal),
    resuelto: false,
  }));
}

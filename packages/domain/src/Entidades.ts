/**
 * Port parcial de `Mercurio.Domain/Entities/Entidades.cs`: solo las entidades que
 * necesita `CalculosHorario`. Las demás (Calendario completo, Nómina, Reclamación…)
 * se añadirán al portar sus módulos de cálculo.
 *
 * Convenciones del port:
 * - Horas: minutos desde medianoche (`Horas.ts`).
 * - Importes en euros: **céntimos enteros** (`Centimos`); las unidades de dietas
 *   (desayuno/comida/cena, 0–1+) van en coma flotante como en el original.
 * - Fechas: cadenas `YYYY-MM-DD`, sin zona horaria.
 */
import {
  CategoriaGrafico, CategoriaTrabajador, CentroTrabajo, CodigoIncidencia, Incidencia,
  SituacionTrabajador, TipoConceptoNomina, TipoDia, TipoNomina, TipoReclamacion, TipoRegulacion, Turno,
} from "./enums";

export type Centimos = number;

/** Campos de horario y resultados de cálculo comunes a gráficos y servicios (`Horario`). */
export interface Horario {
  id?: number;
  noCalcular: boolean;
  categoria: CategoriaGrafico;
  numero: number;
  tipoDia: TipoDia;
  turno: Turno;
  inicio: number | null;
  final: number | null;
  inicioPartido: number | null;
  finalPartido: number | null;
  valoracion: number;
  tiempoTotal: number;
  tiempoPartido: number;
  trabajadas: number;
  trabajadasConvenio: number;
  tiempoVacio: number;
  acumuladas: number;
  nocturnas: number;
  desayuno: number;
  comida: number;
  cena: number;
  tienePlusPaqueteria: boolean;
}

export interface Servicio extends Horario {
  incidencia: Incidencia;
  codigo: CodigoIncidencia;
  plusPaqueteria: Centimos;
  facturadoPaqueteria: Centimos;
  limpieza: number;
  plusMenorDescanso: Centimos;
}

export interface Grafico extends Horario {
  centro: CentroTrabajo;
  /** Fecha de validez del grupo de gráficos (YYYY-MM-DD). */
  fecha: string;
  plusCena: number;
  tieneErrorTiempoPartido: boolean;
  itinerarios: ItinerarioGrafico[];
}

/** Tramo de un gráfico: hora de inicio, itinerario, final y tiempo total (minutos; null = sin dato). */
export interface ItinerarioGrafico {
  id?: number;
  graficoId?: number;
  inicio: number | null;
  itinerario: string | null;
  descripcion: string | null;
  final: number | null;
  tiempoTotal: number;
}

/** Línea de transporte con itinerarios. */
export interface Linea {
  id?: number;
  nombre: string;
  descripcion: string | null;
  itinerarios: Itinerario[];
}

/** Itinerario catalogado de una línea (tiempos en minutos). */
export interface Itinerario {
  id?: number;
  lineaId: number;
  nombre: string;
  descripcion: string | null;
  tiempoReal: number;
  tiempoPago: number;
  paradas: Parada[];
}

/** Parada de un itinerario (tiempo en minutos desde el inicio). */
export interface Parada {
  id?: number;
  itinerarioId: number;
  orden: number;
  descripcion: string | null;
  tiempo: number;
}

/** Uno de los tres servicios de un día: anual (planificado), trabajado (real) o virtual (computado). */
export interface DiaCalendario {
  id?: number;
  calendarioId?: number;
  fecha: string;
  esFestivo: boolean;
  servicioAnual: Servicio;
  servicioTrabajado: Servicio;
  servicioVirtual: Servicio;
  notas: string | null;
  vehiculos: string | null;
  refuerzos: number;
  dndCobrado: boolean;
  dndsCobradosPorDescanso: number;
  /** Marcado cuando el trabajador lo modificó desde el portal web. */
  isRemoteUpdated: boolean;
}

export interface Festivo {
  id?: number;
  fecha: string;
}

export interface TablaSalarial {
  id?: number;
  categoria: CategoriaTrabajador;
  sueldoBaseDiario: Centimos;
  sueldoBaseMensual: Centimos;
  sueldoBaseAnual: Centimos;
  complementoSalarial: Centimos;
  baseAntiguedad: Centimos;
  precioHoraExtra: Centimos;
  precioQuebrantoMoneda: Centimos;
  pagaSeptiembre: Centimos;
  importeDndCobrado: Centimos;
  seguroAccidentes: Centimos;
  porcentajeSeguridadSocial: number;
  porcentajeDesempleo: number;
}

/** Campos de `Conductor` que usan los cálculos del calendario, la nómina y los saldos. */
export interface Conductor {
  id?: number;
  matricula: number;
  nombre: string;
  apellidos: string;
  centro: CentroTrabajo;
  categoria: CategoriaTrabajador;
  situacion: SituacionTrabajador;
  /** Fecha de antigüedad (YYYY-MM-DD). */
  fechaAntiguedad: string;
  /** Porcentaje de IRPF (0–100). */
  porcentajeIrpf: number;
  /** Acumuladas y pendientes con los que el conductor empieza de cero (horas en minutos, DCs/DNDs en unidades). */
  acumuladasIniciales: number;
  dcsIniciales: number;
  dndsIniciales: number;
  /** Trabajador con jornada reducida (dato de la ficha, para el Excel crudo). */
  isReduccionJornada?: boolean;
  regulaciones: Regulacion[];
}

/** Regulación manual o automática de horas/DCs/DNDs de un conductor. */
export interface Regulacion {
  id?: number;
  conductorId: number;
  tipoRegulacion: TipoRegulacion;
  fecha: string;
  /** Horas reguladas, en minutos (positivas suman, negativas restan). */
  horas: number;
  dcs: number;
  dnds: number;
  motivo: string | null;
}

/** Contadores e importes mensuales de un calendario (`ResumenCalendario`); importes en céntimos, horas en minutos. */
export interface ResumenCalendario {
  id?: number;
  calendarioId?: number;
  diasActivo: number;
  diasInactivo: number;
  diasTrabajo: number;
  diasTrabajoJD: number;
  diasTrabajoFN: number;
  diasOV: number;
  diasJD: number;
  diasFN: number;
  diasE: number;
  diasDS: number;
  diasDC: number;
  diasF6: number;
  diasF6D: number;
  diasDND: number;
  diasDF: number;
  diasPER: number;
  diasEJD: number;
  diasEFN: number;
  diasOVJD: number;
  diasOVFN: number;
  diasF6DC: number;
  diasFOR: number;
  diasFORJD: number;
  diasFORFN: number;
  diasOVA: number;
  diasOVAJD: number;
  diasOVAFN: number;
  diasLAC: number;
  diasLACJD: number;
  diasLACFN: number;
  diasCO: number;
  diasCE: number;
  diasRE: number;
  diasHorasSindicales: number;
  diasComiteJD: number;
  diasComiteDC: number;
  sabadosTrabajados: number;
  sabadosDescansados: number;
  domingosTrabajados: number;
  domingosDescansados: number;
  festivosTrabajados: number;
  festivosDescansados: number;
  diasTurno1: number;
  diasTurno2: number;
  diasTurno3: number;
  diasTurno4: number;
  diasConRefuerzo: number;
  findesCompletos: number;
  diasDeberiaTrabajar: number;
  diasDeberiaDescansar: number;
  diasDeberiaVacaciones: number;
  horasTrabajadas: number;
  horasTrabajadasConvenio: number;
  horasAcumuladas: number;
  horasAcumuladasVirtual: number;
  horasNocturnas: number;
  desayunos: number;
  desayunosVirtual: number;
  comidas: number;
  comidasVirtual: number;
  cenas: number;
  cenasVirtual: number;
  totalDietas: number;
  totalDietasVirtual: number;
  diasConPlusPaqueteria: number;
  facturadoPaqueteria: number;
  plusesPaqueteria: Centimos;
  plusesMenorDescanso: Centimos;
  limpiezas: number;
  totalLimpiezas: number;
  importeDietas: Centimos;
  importeDietasVirtual: Centimos;
  importePlusSabados: Centimos;
  importePlusFestivos: Centimos;
  importePlusPaqueteria: Centimos;
  importePlusLimpieza: Centimos;
  importePlusMenorDescanso: Centimos;
  importePlusNocturnidad: Centimos;
  importePlusNocturnidadParcial: Centimos;
  importePlusNavidad: Centimos;
  importePlusViaje: Centimos;
  importeQuebrantoMoneda: Centimos;
  importeVariableVacaciones: Centimos;
  importeRefuerzos: Centimos;
  errores: string;
  totalDndsCobrados: number;
  importeDndsCobrados: Centimos;
  totalDndsCobradosPorDescanso: number;
  importeDndsCobradosPorDescanso: Centimos;
}

/** Totalizadores calculados de `ResumenCalendario` (propiedades computadas del original). */
export const totalDiasTrabajados = (r: ResumenCalendario): number =>
  r.diasTrabajo + r.diasTrabajoJD + r.diasTrabajoFN + r.diasDC;
export const totalDescansos = (r: ResumenCalendario): number =>
  r.diasJD + r.diasFN + r.diasDS + r.diasDF;
export const totalDiasVacaciones = (r: ResumenCalendario): number =>
  r.diasOV + r.diasOVJD + r.diasOVFN;
export const totalDiasE = (r: ResumenCalendario): number =>
  r.diasE + r.diasEJD + r.diasEFN;
export const totalDiasTrabajoEnDescanso = (r: ResumenCalendario): number =>
  r.diasTrabajoJD + r.diasTrabajoFN;
export const totalDiasLAC = (r: ResumenCalendario): number =>
  r.diasLAC + r.diasLACJD + r.diasLACFN;
export const totalDiasComite = (r: ResumenCalendario): number =>
  r.diasCO + r.diasCE + r.diasHorasSindicales;
export const totalImporteDndsCobrados = (r: ResumenCalendario): Centimos =>
  r.importeDndsCobrados + r.importeDndsCobradosPorDescanso;
export const hasErrors = (r: ResumenCalendario): boolean =>
  r.errores.trim() !== "";

export interface Calendario {
  id?: number;
  conductorId: number;
  conductor: Conductor | null;
  centro: CentroTrabajo;
  /** Primer día del mes al que corresponde ("YYYY-MM-01"). */
  fecha: string;
  resumen: ResumenCalendario | null;
  dias: DiaCalendario[];
  totalImportePlusSabados: Centimos;
  totalImportePlusFestivos: Centimos;
  totalImportePlusNocturnidad: Centimos;
  totalImportePlusNocturnidadParcial: Centimos;
  totalImportePlusPaqueteria: Centimos;
  totalImportePlusLimpieza: Centimos;
  totalImportePlusMenorDescanso: Centimos;
  totalImportePlusNavidad: Centimos;
  totalImportePlusViaje: Centimos;
  totalQuebrantoMoneda: Centimos;
  totalRefuerzos: Centimos;
  totalImporteDietas: Centimos;
  totalDcsPendientes: Centimos;
  totalDndsPendientes: Centimos;
  totalImporteDndsCobrados: Centimos;
}

/** Nómina generada; todos los importes en céntimos, porcentajes 0–100. */
export interface Nomina {
  id?: number;
  conductorId: number;
  tipoNomina: TipoNomina;
  /** "YYYY-MM-DD". */
  fecha: string;
  fechaInicio: string;
  fechaFinal: string;
  fechaAntiguedad: string;
  porcentajeIrpf: number;
  porcentajeSeguridadSocial: number;
  porcentajeDesempleo: number;
  baseIrpf: Centimos;
  prorrateoPagas: Centimos;
  baseSeguridadSocial: Centimos;
  descuentoIrpf: Centimos;
  descuentoSeguridadSocial: Centimos;
  descuentoDesempleo: Centimos;
  totalDevengado: Centimos;
  totalDeducciones: Centimos;
  totalLiquido: Centimos;
  conceptos: ConceptoNomina[];
}

export interface ConceptoNomina {
  id?: number;
  nominaId?: number;
  tipoConceptoNomina: TipoConceptoNomina;
  codigo: number;
  computaParaIrpf: boolean;
  textoConcepto: string;
  unidades: number;
  importeBase: Centimos;
  devengado: Centimos;
  deduccion: Centimos;
}

export interface OpcionesCentro {
  id?: number;
  centro: CentroTrabajo;
  numerosL: string | null;
  numerosV: string | null;
  numerosS: string | null;
  numerosF: string | null;
  numerosR: string | null;
  limpiezasMes: number;
  pagarPlusViaje: boolean;
  importePlusViaje: Centimos;
  festivos: Festivo[];
}

export interface Convenio {
  id?: number;
  año: number;
  /** `JornadaMedia` y el resto de duraciones: minutos. */
  jornadaMedia: number;
  jornadaAnual: number;
  diasTrabajoAnuales: number;
  diasDescansoAnuales: number;
  descansosSueltosAnuales: number;
  diasVacacionesAnuales: number;
  findesCompletosAnuales: number;
  diasTrabajadosSeguidos: number;
  descansosSueltosMes: number;
  minimoDescansosMes: number;
  maximoDescansosMes: number;
  maximoFindesSeguidos: number;
  jornadaMaxima: number;
  jornadaMaximaFindes: number;
  jornadaMaximaPartida: number;
  tiempoPartidoMaximo: number;
  inicioNocturnas: number;
  finalNocturnas: number;
  limiteDesayuno: number;
  inicioComidaContinuo: number;
  finalComidaContinuo: number;
  inicioComidaPartido: number;
  finalComidaPartido: number;
  inicioCena: number;
  finalCena: number;
  limitePlusCena: number;
  porcentajeDesayuno: number;
  porcentajePlusCena: number;
  maximoLimpiezas: number;
  /** Importe de una dieta, en céntimos (15.37 € → 1537). */
  importeDietas: Centimos;
  importePlusFestivos: Centimos;
  importePlusSabados: Centimos;
  importePlusMenorDescanso: Centimos;
  importePlusLimpieza: Centimos;
  importePlusPaqueteria: Centimos;
  importePlusNocturnidad: Centimos;
  importePlusNocturnidadDiario: Centimos;
  importePlusNavidad: Centimos;
  importeRefuerzos: Centimos;
  opcionesCentro: OpcionesCentro[];
  tablasSalariales: TablaSalarial[];
}

/** Valores por defecto del convenio, idénticos a los del original (Entidades.cs). */
export function nuevoConvenio(): Convenio {
  return {
    año: 0,
    jornadaMedia: 7 * 60 + 20,
    jornadaAnual: 1650,
    diasTrabajoAnuales: 225,
    diasDescansoAnuales: 109,
    descansosSueltosAnuales: 15,
    diasVacacionesAnuales: 31,
    findesCompletosAnuales: 21,
    diasTrabajadosSeguidos: 6,
    descansosSueltosMes: 2,
    minimoDescansosMes: 2,
    maximoDescansosMes: 2,
    maximoFindesSeguidos: 2,
    jornadaMaxima: 8 * 60 + 30,
    jornadaMaximaFindes: 9 * 60,
    jornadaMaximaPartida: 10 * 60,
    tiempoPartidoMaximo: 3 * 60,
    inicioNocturnas: 22 * 60,
    finalNocturnas: 6 * 60,
    limiteDesayuno: 6 * 60,
    inicioComidaContinuo: 12 * 60 + 30,
    finalComidaContinuo: 15 * 60 + 30,
    inicioComidaPartido: 11 * 60 + 45,
    finalComidaPartido: 15 * 60 + 15,
    inicioCena: 22 * 60,
    finalCena: 23 * 60,
    limitePlusCena: 0,
    porcentajeDesayuno: 80,
    porcentajePlusCena: 25,
    maximoLimpiezas: 21,
    // Importes en céntimos: 15.37 € etc.
    importeDietas: 1537,
    importePlusFestivos: 4305,
    importePlusSabados: 2153,
    importePlusMenorDescanso: 896,
    importePlusLimpieza: 1014,
    importePlusPaqueteria: 787,
    importePlusNocturnidad: 14009,
    importePlusNocturnidadDiario: 100,
    importePlusNavidad: 16304,
    importeRefuerzos: 494,
    opcionesCentro: [],
    tablasSalariales: [],
  };
}

/** Valores por defecto de un `Conductor` nuevo (equivale a `new Conductor()`). */
export function nuevoConductor(parciales: Partial<Conductor> = {}): Conductor {
  return {
    matricula: 0,
    nombre: "",
    apellidos: "",
    centro: CentroTrabajo.Todos,
    categoria: CategoriaTrabajador.Conductor,
    situacion: SituacionTrabajador.Fijo,
    fechaAntiguedad: "",
    porcentajeIrpf: 0,
    acumuladasIniciales: 0,
    dcsIniciales: 0,
    dndsIniciales: 0,
    regulaciones: [],
    ...parciales,
  };
}

/** Valores por defecto de una `Regulacion` nueva. */
export function nuevaRegulacion(parciales: Partial<Regulacion> = {}): Regulacion {
  return {
    conductorId: 0,
    tipoRegulacion: TipoRegulacion.Manual,
    fecha: "",
    horas: 0,
    dcs: 0,
    dnds: 0,
    motivo: null,
    ...parciales,
  };
}

/** Valores por defecto de una `TablaSalarial` nueva (equivale a `new TablaSalarial()`). */
export function nuevaTablaSalarial(parciales: Partial<TablaSalarial> = {}): TablaSalarial {
  return {
    categoria: CategoriaTrabajador.Conductor,
    sueldoBaseDiario: 0, sueldoBaseMensual: 0, sueldoBaseAnual: 0,
    complementoSalarial: 0, baseAntiguedad: 0,
    precioHoraExtra: 0, precioQuebrantoMoneda: 0, pagaSeptiembre: 0, importeDndCobrado: 0, seguroAccidentes: 0,
    porcentajeSeguridadSocial: 0, porcentajeDesempleo: 0,
    ...parciales,
  };
}

/** Valores por defecto de un `ResumenCalendario` nuevo. */
export function nuevoResumenCalendario(parciales: Partial<ResumenCalendario> = {}): ResumenCalendario {
  const ceros = { ...cerosResumen } as ResumenCalendario;
  return { ...ceros, ...parciales };
}

const cerosResumen = {
  diasActivo: 0, diasInactivo: 0, diasTrabajo: 0, diasTrabajoJD: 0, diasTrabajoFN: 0,
  diasOV: 0, diasJD: 0, diasFN: 0, diasE: 0, diasDS: 0, diasDC: 0, diasF6: 0, diasF6D: 0,
  diasDND: 0, diasDF: 0, diasPER: 0, diasEJD: 0, diasEFN: 0, diasOVJD: 0, diasOVFN: 0,
  diasF6DC: 0, diasFOR: 0, diasFORJD: 0, diasFORFN: 0, diasOVA: 0, diasOVAJD: 0, diasOVAFN: 0,
  diasLAC: 0, diasLACJD: 0, diasLACFN: 0, diasCO: 0, diasCE: 0, diasRE: 0,
  diasHorasSindicales: 0, diasComiteJD: 0, diasComiteDC: 0,
  sabadosTrabajados: 0, sabadosDescansados: 0, domingosTrabajados: 0, domingosDescansados: 0,
  festivosTrabajados: 0, festivosDescansados: 0,
  diasTurno1: 0, diasTurno2: 0, diasTurno3: 0, diasTurno4: 0, diasConRefuerzo: 0,
  findesCompletos: 0, diasDeberiaTrabajar: 0, diasDeberiaDescansar: 0, diasDeberiaVacaciones: 0,
  horasTrabajadas: 0, horasTrabajadasConvenio: 0, horasAcumuladas: 0, horasAcumuladasVirtual: 0,
  horasNocturnas: 0, desayunos: 0, desayunosVirtual: 0, comidas: 0, comidasVirtual: 0,
  cenas: 0, cenasVirtual: 0, totalDietas: 0, totalDietasVirtual: 0,
  diasConPlusPaqueteria: 0, facturadoPaqueteria: 0, plusesPaqueteria: 0, plusesMenorDescanso: 0,
  limpiezas: 0, totalLimpiezas: 0,
  importeDietas: 0, importeDietasVirtual: 0, importePlusSabados: 0, importePlusFestivos: 0,
  importePlusPaqueteria: 0, importePlusLimpieza: 0, importePlusMenorDescanso: 0,
  importePlusNocturnidad: 0, importePlusNocturnidadParcial: 0, importePlusNavidad: 0,
  importePlusViaje: 0, importeQuebrantoMoneda: 0, importeVariableVacaciones: 0, importeRefuerzos: 0,
  errores: "",
  totalDndsCobrados: 0, importeDndsCobrados: 0, totalDndsCobradosPorDescanso: 0,
  importeDndsCobradosPorDescanso: 0,
} as const satisfies Partial<ResumenCalendario>;

/** Valores por defecto de un `Calendario` nuevo. */
export function nuevoCalendario(parciales: Partial<Calendario> = {}): Calendario {
  return {
    conductorId: 0,
    conductor: null,
    centro: CentroTrabajo.Todos,
    fecha: "",
    resumen: null,
    dias: [],
    totalImportePlusSabados: 0, totalImportePlusFestivos: 0, totalImportePlusNocturnidad: 0,
    totalImportePlusNocturnidadParcial: 0, totalImportePlusPaqueteria: 0, totalImportePlusLimpieza: 0,
    totalImportePlusMenorDescanso: 0, totalImportePlusNavidad: 0, totalImportePlusViaje: 0,
    totalQuebrantoMoneda: 0, totalRefuerzos: 0, totalImporteDietas: 0,
    totalDcsPendientes: 0, totalDndsPendientes: 0, totalImporteDndsCobrados: 0,
    ...parciales,
  };
}

/** Valores por defecto de un `DiaCalendario` nuevo (tres servicios vacíos). */
export function nuevoDiaCalendario(parciales: Partial<DiaCalendario> = {}): DiaCalendario {
  return {
    fecha: "",
    esFestivo: false,
    servicioAnual: nuevoServicio(),
    servicioTrabajado: nuevoServicio(),
    servicioVirtual: nuevoServicio(),
    notas: null,
    vehiculos: null,
    refuerzos: 0,
    dndCobrado: false,
    dndsCobradosPorDescanso: 0,
    isRemoteUpdated: false,
    ...parciales,
  };
}

/** Valores por defecto de una `Nomina` nueva (equivale a `new Nomina()`). */
export function nuevaNomina(parciales: Partial<Nomina> = {}): Nomina {
  return {
    conductorId: 0,
    tipoNomina: TipoNomina.Mensual,
    fecha: "", fechaInicio: "", fechaFinal: "", fechaAntiguedad: "",
    porcentajeIrpf: 0, porcentajeSeguridadSocial: 0, porcentajeDesempleo: 0,
    baseIrpf: 0, prorrateoPagas: 0, baseSeguridadSocial: 0,
    descuentoIrpf: 0, descuentoSeguridadSocial: 0, descuentoDesempleo: 0,
    totalDevengado: 0, totalDeducciones: 0, totalLiquido: 0,
    conceptos: [],
    ...parciales,
  };
}

/** Valores por defecto de un `ConceptoNomina` nuevo. */
export function nuevoConceptoNomina(parciales: Partial<ConceptoNomina> = {}): ConceptoNomina {
  return {
    tipoConceptoNomina: TipoConceptoNomina.SalarioBase,
    codigo: 0,
    computaParaIrpf: true,
    textoConcepto: "",
    unidades: 0,
    importeBase: 0,
    devengado: 0,
    deduccion: 0,
    ...parciales,
  };
}

/**
 * Reclamación mensual de un conductor. Los importes de pluses/quebranto son
 * céntimos; los de dietas son *unidades* (el importe en céntimos va por
 * separado en `importeTotal`). Los conceptos mensuales llevan fecha `""`
 * (equivalente al DateTime.MinValue del original).
 */
export interface Reclamacion {
  id?: number;
  conductorId: number;
  fecha: string;
  fechaEfecto: string;
  codigo: string | null;
  notas: string | null;
  notaInterna: string | null;
  cerrada: boolean;
  conceptosReclamados: ConceptoReclamado[];
}

/** Resuelta cuando tiene conceptos y todos están marcados como resueltos. */
export const esResuelta = (r: Reclamacion): boolean =>
  r.conceptosReclamados.length > 0 && r.conceptosReclamados.every((c) => c.resuelto);

export interface ConceptoReclamado {
  id?: number;
  reclamacionId?: number;
  /** Fecha del concepto ("" para los importes mensuales). */
  fecha: string;
  tipo: TipoReclamacion;
  descripcion: string | null;
  graficoTrabajado: number;
  /** Horas reclamables, en minutos. */
  horasReales: number;
  horasCobradas: number;
  /** Céntimos (o unidades de dieta según el tipo). */
  importeReal: number;
  importeCobrado: number;
  incidenciasReales: number;
  incidenciasCobradas: number;
  importeTotal: number;
  resuelto: boolean;
}

export const horasReclamadasDe = (c: ConceptoReclamado): number => c.horasReales - c.horasCobradas;
export const importeReclamadoDe = (c: ConceptoReclamado): number => c.importeReal - c.importeCobrado;
export const incidenciasReclamadasDe = (c: ConceptoReclamado): number => c.incidenciasReales - c.incidenciasCobradas;

/** Valores por defecto de una `Reclamacion` nueva. */
export function nuevaReclamacion(parciales: Partial<Reclamacion> = {}): Reclamacion {
  return {
    conductorId: 0,
    fecha: "",
    fechaEfecto: "",
    codigo: null,
    notas: null,
    notaInterna: null,
    cerrada: false,
    conceptosReclamados: [],
    ...parciales,
  };
}

/** Valores por defecto de un `ConceptoReclamado` nuevo. */
export function nuevoConceptoReclamado(parciales: Partial<ConceptoReclamado> = {}): ConceptoReclamado {
  return {
    reclamacionId: 0,
    fecha: "",
    tipo: TipoReclamacion.OtraHoras,
    descripcion: null,
    graficoTrabajado: 0,
    horasReales: 0,
    horasCobradas: 0,
    importeReal: 0,
    importeCobrado: 0,
    incidenciasReales: 0,
    incidenciasCobradas: 0,
    importeTotal: 0,
    resuelto: false,
    ...parciales,
  };
}

export function nuevoOpcionesCentro(parciales: Partial<OpcionesCentro> = {}): OpcionesCentro {
  return {
    centro: CentroTrabajo.Todos,
    numerosL: null, numerosV: null, numerosS: null, numerosF: null, numerosR: null,
    limpiezasMes: 0,
    pagarPlusViaje: false,
    importePlusViaje: 0,
    festivos: [],
    ...parciales,
  };
}

/** Valores por defecto de un `Servicio` nuevo (equivale a `new Servicio()`). */
export function nuevoServicio(parciales: Partial<Servicio> = {}): Servicio {
  return {
    noCalcular: false,
    categoria: CategoriaGrafico.Conduccion,
    numero: 0,
    tipoDia: TipoDia.Ninguno,
    turno: Turno.SinTurno,
    inicio: null, final: null, inicioPartido: null, finalPartido: null,
    valoracion: 0, tiempoTotal: 0, tiempoPartido: 0,
    trabajadas: 0, trabajadasConvenio: 0, tiempoVacio: 0, acumuladas: 0, nocturnas: 0,
    desayuno: 0, comida: 0, cena: 0,
    tienePlusPaqueteria: false,
    incidencia: Incidencia.Inactivo,
    codigo: CodigoIncidencia.Ninguno,
    plusPaqueteria: 0, facturadoPaqueteria: 0, limpieza: 0, plusMenorDescanso: 0,
    ...parciales,
  };
}

/** Copia superficial, equivalente a `Clonar()` (MemberwiseClone). */
export function clonarServicio(s: Servicio): Servicio {
  return { ...s };
}

/** Valores por defecto de un `Grafico` nuevo (equivale a `new Grafico()`). */
export function nuevoGrafico(parciales: Partial<Grafico> = {}): Grafico {
  return {
    noCalcular: false,
    categoria: CategoriaGrafico.Conduccion,
    numero: 0,
    tipoDia: TipoDia.Ninguno,
    turno: Turno.SinTurno,
    inicio: null, final: null, inicioPartido: null, finalPartido: null,
    valoracion: 0, tiempoTotal: 0, tiempoPartido: 0,
    trabajadas: 0, trabajadasConvenio: 0, tiempoVacio: 0, acumuladas: 0, nocturnas: 0,
    desayuno: 0, comida: 0, cena: 0,
    tienePlusPaqueteria: false,
    centro: CentroTrabajo.Todos,
    fecha: "",
    plusCena: 0,
    tieneErrorTiempoPartido: false,
    itinerarios: [],
    ...parciales,
  };
}

/** Valores por defecto de un `ItinerarioGrafico` nuevo. */
export function nuevoItinerarioGrafico(parciales: Partial<ItinerarioGrafico> = {}): ItinerarioGrafico {
  return {
    graficoId: 0,
    inicio: null,
    itinerario: null,
    descripcion: null,
    final: null,
    tiempoTotal: 0,
    ...parciales,
  };
}

/** Valores por defecto de una `Linea` nueva. */
export function nuevaLinea(parciales: Partial<Linea> = {}): Linea {
  return {
    nombre: "",
    descripcion: null,
    itinerarios: [],
    ...parciales,
  };
}

/** Valores por defecto de un `Itinerario` nuevo. */
export function nuevoItinerario(parciales: Partial<Itinerario> = {}): Itinerario {
  return {
    lineaId: 0,
    nombre: "",
    descripcion: null,
    tiempoReal: 0,
    tiempoPago: 0,
    paradas: [],
    ...parciales,
  };
}

/** Valores por defecto de una `Parada` nueva. */
export function nuevaParada(parciales: Partial<Parada> = {}): Parada {
  return {
    itinerarioId: 0,
    orden: 0,
    descripcion: null,
    tiempo: 0,
    ...parciales,
  };
}

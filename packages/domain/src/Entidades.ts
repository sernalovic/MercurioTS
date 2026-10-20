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
  CategoriaGrafico, CentroTrabajo, CodigoIncidencia, Incidencia, TipoDia, Turno,
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
}

/** Uno de los tres servicios de un día: anual (planificado), trabajado (real) o virtual (computado). */
export interface DiaCalendario {
  id?: number;
  fecha: string;
  esFestivo: boolean;
  servicioAnual: Servicio;
  servicioTrabajado: Servicio;
  servicioVirtual: Servicio;
}

export interface Festivo {
  id?: number;
  fecha: string;
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
    ...parciales,
  };
}

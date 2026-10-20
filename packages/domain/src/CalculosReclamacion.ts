/**
 * Port de `Mercurio.Domain/Calculos/CalculosReclamacion.cs`.
 * Saldos de acumuladas/DCs/DNDs/vacaciones (REGLAS-CALCULO.md 15) y generación
 * de reclamaciones (secciones 9, 13 y 14).
 *
 * Importes en céntimos (los conceptos de dieta guardan *unidades* en
 * importeReal/importeCobrado); horas en minutos; los conceptos mensuales usan
 * fecha `""` (DateTime.MinValue del original).
 */
import * as Horas from "./Horas";
import {
  Calendario, ConceptoReclamado, Convenio, Reclamacion, ResumenCalendario,
  esResuelta, nuevoConceptoReclamado,
} from "./Entidades";
import { Incidencia, SituacionTrabajador, TipoReclamacion } from "./enums";
import { año as añoDe, mes as mesDe } from "./Fechas";
import { esDescanso, esTrabajo, nombreIncidencia } from "./Incidencias";
import { importesMensuales } from "./CalculosCalendario";

// ---- 15 Saldos ----

/** Saldos que se arrastran de meses anteriores para un calendario (REGLAS-CALCULO.md 15). */
export interface SaldosEntrada {
  calendario: Calendario;
  resumenHastaMesAnterior: ResumenCalendario | null;
  resumenHastaAñoAnterior: ResumenCalendario | null;
  /** Dcs reclamados en reclamaciones aún en curso, hasta el mes anterior (unidades). */
  dcsReclamadosEnCursoHastaMesAnterior: number;
  /** Dnds reclamados en reclamaciones aún en curso, hasta el mes anterior (unidades). */
  dndsReclamadosEnCursoHastaMesAnterior: number;
}

/** Regulaciones del conductor anteriores al mes siguiente del calendario. */
function regulacionesHastaMes(c: Calendario): { horas: number; dcs: number; dnds: number }[] {
  const y = añoDe(c.fecha);
  const m = mesDe(c.fecha);
  const limite = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  return (c.conductor?.regulaciones ?? []).filter((r) => r.fecha < limite);
}

/** Horas acumuladas totales hasta el mes (en minutos). */
export function horasAcumuladasHastaMes(e: SaldosEntrada, convenio: Convenio | null): number {
  const anterior = e.resumenHastaMesAnterior;
  const mesRes = e.calendario.resumen;
  if (anterior === null || mesRes === null) return 0;
  const jornada = convenio?.jornadaMedia ?? 0; // minutos
  const regulaciones = regulacionesHastaMes(e.calendario).reduce((acc, r) => acc + r.horas, 0);
  const f6PrevioAño = (e.resumenHastaAñoAnterior?.diasF6 ?? 0) * jornada;
  const f6d = (anterior.diasF6D + mesRes.diasF6D) * jornada;
  return (e.calendario.conductor?.acumuladasIniciales ?? 0) + regulaciones
    + anterior.horasAcumuladasVirtual + mesRes.horasAcumuladasVirtual - f6PrevioAño - f6d;
}

export function dcsPendientesHastaMes(e: SaldosEntrada): number {
  const anterior = e.resumenHastaMesAnterior;
  const mesRes = e.calendario.resumen;
  if (anterior === null || mesRes === null) return 0;
  const regulados = regulacionesHastaMes(e.calendario).reduce((acc, r) => acc + r.dcs, 0);
  return (e.calendario.conductor?.dcsIniciales ?? 0) + regulados
    - (anterior.diasDC + mesRes.diasDC) - (anterior.diasF6DC + mesRes.diasF6DC)
    - e.dcsReclamadosEnCursoHastaMesAnterior;
}

export function dndsPendientesHastaMes(e: SaldosEntrada): number {
  const a = e.resumenHastaMesAnterior;
  const m = e.calendario.resumen;
  if (a === null || m === null) return 0;
  const regulados = regulacionesHastaMes(e.calendario).reduce((acc, r) => acc + r.dnds, 0);
  const generados = a.diasComiteJD + a.diasTrabajoJD + a.diasTrabajoFN
    + m.diasComiteJD + m.diasTrabajoJD + m.diasTrabajoFN + m.diasFORJD + m.diasFORFN;
  const disfrutados = a.diasDND + a.diasDF + m.diasDND + m.diasDF;
  const cobrados = a.totalDndsCobrados + m.totalDndsCobrados;
  return (e.calendario.conductor?.dndsIniciales ?? 0) + regulados + generados - disfrutados - cobrados
    - e.dndsReclamadosEnCursoHastaMesAnterior;
}

/** DCs generados hasta el mes: pendientes más el cociente entre horas acumuladas y la jornada media. */
export function dcsGeneradosHastaMes(e: SaldosEntrada, convenio: Convenio | null): number {
  const jornada = convenio === null ? 1 : Horas.EnHoras(convenio.jornadaMedia);
  return dcsPendientesHastaMes(e) + Horas.EnHoras(horasAcumuladasHastaMes(e, convenio)) / jornada;
}

export function vacacionesPendientesHastaMes(e: SaldosEntrada): number {
  const a = e.resumenHastaMesAnterior;
  const m = e.calendario.resumen;
  if (a === null || m === null || e.calendario.conductor?.situacion !== SituacionTrabajador.Eventual) return 0;
  return a.diasDeberiaVacaciones + m.diasDeberiaVacaciones
    - (a.diasOV + a.diasOVJD + a.diasOVFN + m.diasOV + m.diasOVJD + m.diasOVFN);
}

// ---- 9, 13 y 14 Reclamaciones ----

const TiposDieta: readonly TipoReclamacion[] = [
  TipoReclamacion.DietaDesayuno, TipoReclamacion.DietaComida, TipoReclamacion.DietaCena,
];

const TiposPlus: readonly TipoReclamacion[] = [
  TipoReclamacion.PlusSabados, TipoReclamacion.PlusFestivos, TipoReclamacion.PlusPaqueteria,
  TipoReclamacion.PlusLimpieza, TipoReclamacion.PlusMenorDescanso, TipoReclamacion.PlusNocturnidad,
  TipoReclamacion.PlusNocturnidadParcial, TipoReclamacion.PlusNavidad,
];

/** Redondeo a céntimos enteros (equivale a Math.Round(x, 2) en euros). */
const redCent = (v: number): number => Math.round(v);
/** Redondeo de unidades a 2 decimales. */
const red2u = (v: number): number => Math.round(v * 100) / 100;

/** Horas reclamadas totales de una reclamación, en minutos. */
export function horas(r: Reclamacion): number {
  return r.conceptosReclamados.reduce((acc, c) => acc + c.horasReales - c.horasCobradas, 0);
}

/** Unidades de dietas reclamadas. */
export function dietas(r: Reclamacion): number {
  return r.conceptosReclamados
    .filter((c) => TiposDieta.includes(c.tipo))
    .reduce((acc, c) => acc + c.importeReal - c.importeCobrado, 0);
}

/** Importe en céntimos de los pluses reclamados. */
export function pluses(r: Reclamacion): number {
  return r.conceptosReclamados
    .filter((c) => TiposPlus.includes(c.tipo))
    .reduce((acc, c) => acc + c.importeReal - c.importeCobrado, 0);
}

/** Importe total reclamado en céntimos (suma redondeada concepto a concepto). */
export function importe(r: Reclamacion): number {
  return r.conceptosReclamados.reduce((acc, c) => acc + redCent(c.importeTotal), 0);
}

export interface ConceptoPorIncidencia {
  tipo: TipoReclamacion;
  descripcion: string;
}

/** Concepto a reclamar cuando la situación real no coincide con la esperada; null si no procede. */
export function conceptoPorIncidencia(real: Incidencia, esperada: Incidencia): ConceptoPorIncidencia | null {
  const c = (tipo: TipoReclamacion, descripcion: string): ConceptoPorIncidencia => ({ tipo, descripcion });

  if (esperada === Incidencia.E && real !== Incidencia.E && real !== Incidencia.EJD && real !== Incidencia.EFN) {
    return c(TipoReclamacion.Enfermo, `La situación no es E, sino que es ${nombreIncidencia(real)}`);
  }
  if (esDescanso(esperada) && (esTrabajo(real, 0) || real === Incidencia.PER)) {
    return c(TipoReclamacion.Descanso, `La situación no es ${nombreIncidencia(esperada)}, sino que es ${nombreIncidencia(real)}`);
  }
  if (esperada === Incidencia.DC && real !== Incidencia.DC && real !== Incidencia.F6DC) {
    return c(TipoReclamacion.DC, `La situación no es DC, sino que es ${nombreIncidencia(real)}`);
  }
  if (esperada === Incidencia.DND && real !== Incidencia.DND) {
    return c(TipoReclamacion.DND, `La situación no es DND, sino que es ${nombreIncidencia(real)}`);
  }
  if (esperada === Incidencia.F6 && real !== Incidencia.F6 && real !== Incidencia.F6DC) {
    return c(TipoReclamacion.F6, `La situación no es F6, sino que es ${nombreIncidencia(real)}`);
  }
  if (esperada === Incidencia.F6D && real !== Incidencia.F6 && real !== Incidencia.F6D && real !== Incidencia.F6DC) {
    return c(TipoReclamacion.F6, `La situación no es F6-D, sino que es ${nombreIncidencia(real)}`);
  }
  return null;
}

/**
 * Rellena la reclamación del mes con las diferencias del calendario. La
 * reclamación debe estar vacía (sus conceptos previos ya borrados). Devuelve
 * false si estaba resuelta o cerrada.
 */
export function generarReclamacion(
  reclamacion: Reclamacion, calendario: Calendario, importeDietas: number,
  dcsPendientes: number, dndsPendientes: number, ahora: string,
): boolean {
  if (esResuelta(reclamacion) || reclamacion.cerrada) return false;
  reclamacion.conductorId = calendario.conductorId;
  reclamacion.fecha = calendario.fecha;
  reclamacion.fechaEfecto = ahora;
  reclamacion.codigo = `${añoDe(calendario.fecha)}${String(mesDe(calendario.fecha)).padStart(2, "0")}${calendario.conductor?.matricula ?? 0}`;

  const obtener = (tipo: TipoReclamacion, fecha: string): ConceptoReclamado => {
    let c = reclamacion.conceptosReclamados.find((x) => x.tipo === tipo && x.fecha === fecha);
    if (c === undefined) {
      c = nuevoConceptoReclamado({ reclamacionId: reclamacion.id, tipo, fecha });
      reclamacion.conceptosReclamados.push(c);
    }
    return c;
  };

  for (const { tipo, texto, real, cobrado } of importesMensuales(calendario)) {
    if (redCent(real) <= redCent(cobrado)) continue;
    const c = obtener(tipo, "");
    c.graficoTrabajado = 0; c.descripcion = texto; c.importeCobrado = cobrado; c.importeReal = real;
    c.importeTotal = real - cobrado;
  }

  const pendiente = (tipo: TipoReclamacion, texto: string, calculado: number, cobrado: number): void => {
    if (calculado <= cobrado) return;
    const c = obtener(tipo, "");
    c.graficoTrabajado = 0; c.descripcion = texto;
    c.importeCobrado = cobrado; c.importeReal = calculado; c.importeTotal = 0;
  };
  pendiente(TipoReclamacion.TotalDc, "DCs pendientes", dcsPendientes, calendario.totalDcsPendientes);
  pendiente(TipoReclamacion.TotalDnd, "DNDs pendientes", dndsPendientes, calendario.totalDndsPendientes);

  for (const diaObj of [...calendario.dias].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const t = diaObj.servicioTrabajado;
    const v = diaObj.servicioVirtual;
    const n = Number(diaObj.fecha.slice(8, 10));
    if (t.acumuladas > v.acumuladas) {
      const c = obtener(TipoReclamacion.HorasAcumuladas, diaObj.fecha);
      c.graficoTrabajado = t.numero; c.descripcion = `Horas acumuladas del día ${n}`;
      c.horasCobradas = v.acumuladas; c.horasReales = t.acumuladas; c.importeTotal = 0;
    }
    const dieta = (tipo: TipoReclamacion, nombre: string, real: number, cobrado: number): void => {
      if (red2u(real) <= red2u(cobrado)) return;
      const c = obtener(tipo, diaObj.fecha);
      c.graficoTrabajado = t.numero; c.descripcion = `Dieta de ${nombre} del día ${n}`;
      c.importeCobrado = cobrado; c.importeReal = real; c.importeTotal = (real - cobrado) * importeDietas;
    };
    dieta(TipoReclamacion.DietaDesayuno, "desayuno", t.desayuno, v.desayuno);
    dieta(TipoReclamacion.DietaComida, "comida", t.comida, v.comida);
    dieta(TipoReclamacion.DietaCena, "cena", t.cena, v.cena);

    if (t.incidencia !== v.incidencia && conceptoPorIncidencia(t.incidencia, v.incidencia) !== null) {
      const porIncidencia = conceptoPorIncidencia(t.incidencia, v.incidencia)!;
      const c = obtener(porIncidencia.tipo, diaObj.fecha);
      c.descripcion = porIncidencia.descripcion;
      c.graficoTrabajado = t.numero; c.importeCobrado = c.importeReal = c.importeTotal = 0;
    }
    if (t.numero !== v.numero) {
      const c = obtener(TipoReclamacion.Grafico, diaObj.fecha);
      c.graficoTrabajado = t.numero; c.descripcion = `Gráfico diferente el día ${n} (${v.numero})`;
      c.importeCobrado = c.importeReal = c.importeTotal = 0;
    }
  }

  reclamacion.notas = notas(reclamacion);
  return true;
}

/** Formatea un número como lo hace la cultura es-ES: "15,00" con dos decimales. */
function fmt2(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

/** Texto de notas con los totales de la reclamación. */
export function notas(r: Reclamacion): string {
  const cs = r.conceptosReclamados;
  const horasTotal = horas(r);
  const dietasReclamadas = cs.filter((c) => TiposDieta.includes(c.tipo))
    .reduce((acc, c) => acc + red2u(c.importeReal - c.importeCobrado), 0);
  const dietasTotal = cs.filter((c) => TiposDieta.includes(c.tipo))
    .reduce((acc, c) => acc + redCent(c.importeTotal), 0);
  const plusesTotal = cs.filter((c) => TiposPlus.includes(c.tipo) || c.tipo === TipoReclamacion.Refuerzos)
    .reduce((acc, c) => acc + redCent(c.importeTotal), 0);
  const quebranto = cs.filter((c) => c.tipo === TipoReclamacion.QuebrantoMoneda)
    .reduce((acc, c) => acc + redCent(c.importeTotal), 0);
  // Los céntimos se muestran como euros con dos decimales (es-ES usa coma).
  const euros = (centimos: number): string => fmt2(Math.round(centimos) / 100);

  const sb: string[] = [];
  if (dietasReclamadas > 0) sb.push(`Total dietas = ${fmt2(dietasReclamadas)} (${euros(dietasTotal)} €)\n`);
  if (plusesTotal > 0) sb.push(`Total pluses = ${euros(plusesTotal)} €\n`);
  if (quebranto > 0) sb.push(`Total quebranto moneda = ${euros(quebranto)} €\n`);
  const total = dietasTotal + plusesTotal + quebranto;
  if (total > 0) sb.push(`\nIMPORTE TOTAL = ${euros(total)} €`);
  if (horasTotal > 0) sb.push(`\nTOTAL HORAS = ${Math.trunc(horasTotal / 60)}:${String(horasTotal % 60).padStart(2, "0")}`);
  return sb.join("");
}

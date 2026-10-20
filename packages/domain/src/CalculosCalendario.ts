/**
 * Port de `Mercurio.Domain/Calculos/CalculosCalendario.cs`.
 * Operaciones sobre un calendario mensual (REGLAS-CALCULO.md 7, 8 y 12).
 *
 * Igualdad de dinero: los importes van en céntimos; `Math.Round(x, 2)` del C#
 * sobre euros equivale a redondear al céntimo entero (`redCent`); `Round(x, 4)`
 * sobre euros equivale a redondear a centésimas de céntimo (`red4m`).
 */
import {
  Calendario, Centimos, Convenio, DiaCalendario, Servicio, nuevoDiaCalendario, nuevoResumenCalendario,
  totalDiasTrabajados,
} from "./Entidades";
import * as Horas from "./Horas";
import { CodigoIncidencia, Incidencia, SituacionTrabajador, TipoReclamacion, Turno } from "./enums";
import { año as añoDe, dia as diaDe, diaDeLaSemana, diasEnMes, esFinDeSemana, mes as mesDe } from "./Fechas";
import { esDescanso, esFormacion, esTrabajo, variantesDescanso } from "./Incidencias";

/** Redondeo a céntimos enteros (equivale a Math.Round(x, 2) en euros). */
const redCent = (v: number): number => Math.round(v);
/** Redondeo a 2 decimales de unidades de dietas (igual que el original redondea cada día). */
const red2u = (v: number): number => Math.round(v * 100) / 100;
/** Redondeo a 4 decimales de euros, es decir a centésimas de céntimo. */
const red4m = (v: number): Centimos => Math.round(v * 100) / 100;

// ---- 8 Crear días ----

/** Crea los días del mes y un resumen con todos los días inactivos. */
export function crearDias(calendario: Calendario, año: number, mes: number): void {
  const nDias = diasEnMes(año, mes);
  calendario.dias = Array.from({ length: nDias }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const fechaStr = `${año}-${String(mes).padStart(2, "0")}-${d}`;
    return nuevoDiaCalendario({ calendarioId: calendario.id, fecha: fechaStr });
  });
  calendario.resumen = nuevoResumenCalendario({ calendarioId: calendario.id, diasInactivo: nDias });
}

// ---- 7 Ajustar JDs ----

function convertirVariantes(s: Servicio, aFinDeSemana: boolean): void {
  for (const [jd, fn] of variantesDescanso) {
    if (aFinDeSemana && s.incidencia === jd) {
      s.incidencia = fn;
      return;
    }
    if (!aFinDeSemana && s.incidencia === fn) {
      s.incidencia = jd;
      return;
    }
  }
}

/** Un día ausente (fuera del mes o sin datos) se considera descanso. */
function esDescansoODesconocido(d: DiaCalendario | null): boolean {
  return d === null || esDescanso(d.servicioTrabajado.incidencia);
}

function marcarDescansoSuelto(diaObj: DiaCalendario, anterior: DiaCalendario | null, siguiente: DiaCalendario | null): void {
  const s = diaObj.servicioTrabajado;
  if (s.incidencia !== Incidencia.JD && s.incidencia !== Incidencia.FN && s.incidencia !== Incidencia.DS) return;
  if (!esDescansoODesconocido(anterior) && !esDescansoODesconocido(siguiente)) s.incidencia = Incidencia.DS;
}

/** Convierte JD↔FN según caiga entre semana o fin de semana y marca los descansos sueltos (DS). */
export function ajustarJDs(
  diasL: DiaCalendario[], ultimoMesAnterior: DiaCalendario | null, primeroMesSiguiente: DiaCalendario | null,
): void {
  if (diasL.length === 0) return;
  const ordenados = [...diasL].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const diasMes = diasEnMes(añoDe(ordenados[0]!.fecha), mesDe(ordenados[0]!.fecha));
  const porDia = (n: number): DiaCalendario | undefined => ordenados.find((d) => diaDe(d.fecha) === n);

  for (const diaObj of ordenados) {
    const n = diaDe(diaObj.fecha);
    if (n === 1 || n === diasMes || añoDe(diaObj.fecha) === 9999) continue;
    const s = diaObj.servicioTrabajado;
    if (s.incidencia === Incidencia.DS) s.incidencia = Incidencia.JD;
    convertirVariantes(s, esFinDeSemana(diaObj.fecha));
    marcarDescansoSuelto(diaObj, porDia(n - 1) ?? null, porDia(n + 1) ?? null);
  }

  const ajustarExtremo = (
    diaObj: DiaCalendario | undefined, anterior: DiaCalendario | null, siguiente: DiaCalendario | null,
  ): void => {
    if (diaObj === undefined) return;
    const s = diaObj.servicioTrabajado;
    const finde = esFinDeSemana(diaObj.fecha);
    if (s.incidencia === Incidencia.DS) s.incidencia = finde ? Incidencia.FN : Incidencia.JD;
    convertirVariantes(s, finde);
    if ((s.incidencia === Incidencia.JD || s.incidencia === Incidencia.FN)
      && !esDescansoODesconocido(anterior) && !esDescansoODesconocido(siguiente)) {
      s.incidencia = Incidencia.DS;
    }
  };

  ajustarExtremo(porDia(1), ultimoMesAnterior, porDia(2) ?? null);
  ajustarExtremo(porDia(diasMes), porDia(diasMes - 1) ?? null, primeroMesSiguiente);
}

// ---- 8 Diferencias en contra ----

function sumaPositiva(dias: DiaCalendario[], campo: (s: Servicio) => number): number {
  return dias
    .filter((d) => campo(d.servicioTrabajado) > campo(d.servicioVirtual))
    .reduce((acc, d) => acc + (campo(d.servicioTrabajado) - campo(d.servicioVirtual)), 0);
}

function exceso(real: number, cobrado: number): number {
  return real > cobrado ? redCent(real - cobrado) : 0;
}

export function diferenciaAcumuladas(dias: DiaCalendario[]): number {
  return sumaPositiva(dias, (s) => s.acumuladas);
}

export function diferenciaNocturnas(dias: DiaCalendario[]): number {
  return sumaPositiva(dias, (s) => s.nocturnas);
}

export function diferenciaDesayunos(dias: DiaCalendario[]): number {
  return redCent(sumaPositiva(dias, (s) => s.desayuno));
}

export function diferenciaComidas(dias: DiaCalendario[]): number {
  return redCent(sumaPositiva(dias, (s) => s.comida));
}

export function diferenciaCenas(dias: DiaCalendario[]): number {
  return redCent(sumaPositiva(dias, (s) => s.cena));
}

export function diferenciaPaqueteria(dias: DiaCalendario[]): number {
  return redCent(sumaPositiva(dias, (s) => s.plusPaqueteria));
}

export function diferenciaMenorDescanso(dias: DiaCalendario[]): number {
  return redCent(sumaPositiva(dias, (s) => s.plusMenorDescanso));
}

export interface ImporteMensual {
  tipo: TipoReclamacion;
  texto: string;
  real: Centimos;
  cobrado: Centimos;
}

/** Pares (real según el resumen, cobrado en nómina) de los importes mensuales. */
export function importesMensuales(c: Calendario): ImporteMensual[] {
  const r = c.resumen!;
  return [
    { tipo: TipoReclamacion.PlusSabados, texto: "Importe plus de sábado", real: r.importePlusSabados, cobrado: c.totalImportePlusSabados },
    { tipo: TipoReclamacion.PlusFestivos, texto: "Importe plus de festivo", real: r.importePlusFestivos, cobrado: c.totalImportePlusFestivos },
    { tipo: TipoReclamacion.PlusNocturnidad, texto: "Importe plus de nocturnidad", real: r.importePlusNocturnidad, cobrado: c.totalImportePlusNocturnidad },
    { tipo: TipoReclamacion.PlusNocturnidadParcial, texto: "Importe plus de nocturnidad parcial", real: r.importePlusNocturnidadParcial, cobrado: c.totalImportePlusNocturnidadParcial },
    { tipo: TipoReclamacion.PlusPaqueteria, texto: "Importe plus de paquetería", real: r.importePlusPaqueteria, cobrado: c.totalImportePlusPaqueteria },
    { tipo: TipoReclamacion.PlusLimpieza, texto: "Importe plus de limpieza", real: r.importePlusLimpieza, cobrado: c.totalImportePlusLimpieza },
    { tipo: TipoReclamacion.PlusMenorDescanso, texto: "Importe plus por menor descanso", real: r.importePlusMenorDescanso, cobrado: c.totalImportePlusMenorDescanso },
    { tipo: TipoReclamacion.PlusNavidad, texto: "Importe plus de Navidad", real: r.importePlusNavidad, cobrado: c.totalImportePlusNavidad },
    { tipo: TipoReclamacion.PlusViaje, texto: "Importe plus de viaje", real: r.importePlusViaje, cobrado: c.totalImportePlusViaje },
    { tipo: TipoReclamacion.QuebrantoMoneda, texto: "Importe quebranto de moneda", real: r.importeQuebrantoMoneda, cobrado: c.totalQuebrantoMoneda },
    { tipo: TipoReclamacion.Refuerzos, texto: "Importe refuerzos", real: r.importeRefuerzos, cobrado: c.totalRefuerzos },
    { tipo: TipoReclamacion.DndsCobrados, texto: "Importe DNDs cobrados", real: r.importeDndsCobrados + r.importeDndsCobradosPorDescanso, cobrado: c.totalImporteDndsCobrados },
  ];
}

export function tieneDiferenciasEnContra(c: Calendario | null): boolean {
  if (c === null || c.resumen === null) return false;
  return diferenciaAcumuladas(c.dias) > 0
    || diferenciaNocturnas(c.dias) > 0
    || diferenciaDesayunos(c.dias) > 0 || diferenciaComidas(c.dias) > 0 || diferenciaCenas(c.dias) > 0
    || diferenciaPaqueteria(c.dias) > 0 || diferenciaMenorDescanso(c.dias) > 0
    // Paquetería y menor descanso ya se comparan día a día; el original no repite su comparación mensual.
    || importesMensuales(c)
      .filter((i) => i.tipo !== TipoReclamacion.PlusPaqueteria && i.tipo !== TipoReclamacion.PlusMenorDescanso)
      .some((i) => exceso(i.real, i.cobrado) > 0);
}

/** Copia los importes calculados del resumen a los totales cobrados del calendario. */
export function restablecerImportesEnNomina(c: Calendario): void {
  const r = c.resumen;
  if (r === null) return;
  c.totalImportePlusSabados = r.importePlusSabados;
  c.totalImportePlusFestivos = r.importePlusFestivos;
  c.totalImportePlusNocturnidad = r.importePlusNocturnidad;
  c.totalImportePlusNocturnidadParcial = r.importePlusNocturnidadParcial;
  c.totalImportePlusPaqueteria = r.importePlusPaqueteria;
  c.totalImportePlusLimpieza = r.importePlusLimpieza;
  c.totalImportePlusMenorDescanso = r.importePlusMenorDescanso;
  c.totalImportePlusNavidad = r.importePlusNavidad;
  c.totalImportePlusViaje = r.importePlusViaje;
  c.totalQuebrantoMoneda = r.importeQuebrantoMoneda;
  c.totalRefuerzos = r.importeRefuerzos;
  c.totalImporteDietas = r.importeDietas;
  c.totalImporteDndsCobrados = r.importeDndsCobrados;
}

// ---- 12 Resumen mensual ----

/**
 * Recalcula el resumen del calendario. El conductor debe venir cargado para los
 * cálculos que dependen de su situación.
 */
export function recalcularResumen(
  cal: Calendario, convenio: Convenio | null,
  ultimoMesAnterior: DiaCalendario | null, primeroMesSiguiente: DiaCalendario | null,
): void {
  const r = cal.resumen ?? (cal.resumen = nuevoResumenCalendario({ calendarioId: cal.id }));
  const dias = [...cal.dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const contar = (f: (s: Servicio) => boolean): number => dias.filter((d) => f(d.servicioTrabajado)).length;
  const contarInc = (i: Incidencia): number => contar((s) => s.incidencia === i);
  const trabaja = (d: DiaCalendario): boolean =>
    esTrabajo(d.servicioTrabajado.incidencia, d.servicioTrabajado.numero);
  const descansa = (d: DiaCalendario): boolean => esDescanso(d.servicioTrabajado.incidencia);

  // 12.1 Contadores
  r.diasActivo = contar((s) => s.incidencia !== Incidencia.Inactivo);
  r.diasInactivo = contarInc(Incidencia.Inactivo);
  r.diasTrabajo = contarInc(Incidencia.Trabajo);
  r.diasTrabajoJD = contarInc(Incidencia.TrabajoJD);
  r.diasTrabajoFN = contarInc(Incidencia.TrabajoFN);
  r.diasOV = contarInc(Incidencia.OV);
  r.diasJD = contarInc(Incidencia.JD);
  r.diasFN = contarInc(Incidencia.FN);
  r.diasE = contarInc(Incidencia.E);
  r.diasDS = contarInc(Incidencia.DS);
  r.diasDC = contarInc(Incidencia.DC);
  r.diasF6 = contarInc(Incidencia.F6);
  r.diasF6D = contarInc(Incidencia.F6D);
  r.diasDND = contarInc(Incidencia.DND);
  r.diasDF = contarInc(Incidencia.DF);
  r.diasPER = contarInc(Incidencia.PER);
  r.diasEJD = contarInc(Incidencia.EJD);
  r.diasEFN = contarInc(Incidencia.EFN);
  r.diasOVJD = contarInc(Incidencia.OVJD);
  r.diasOVFN = contarInc(Incidencia.OVFN);
  r.diasF6DC = contarInc(Incidencia.F6DC);
  r.diasFOR = contar((s) => esFormacion(s.incidencia));
  r.diasFORJD = contarInc(Incidencia.FORJD);
  r.diasFORFN = contarInc(Incidencia.FORFN);
  r.diasOVA = contarInc(Incidencia.OVA);
  r.diasOVAJD = contarInc(Incidencia.OVAJD);
  r.diasOVAFN = contarInc(Incidencia.OVAFN);
  r.diasLAC = contarInc(Incidencia.LAC);
  r.diasLACJD = contarInc(Incidencia.LACJD);
  r.diasLACFN = contarInc(Incidencia.LACFN);
  r.diasCO = contar((s) => s.codigo === CodigoIncidencia.Comite);
  r.diasCE = contar((s) => s.codigo === CodigoIncidencia.ComiteEmpresa);
  r.diasRE = contarInc(Incidencia.RE);
  r.diasHorasSindicales = contar((s) => s.codigo === CodigoIncidencia.HorasSindicales);
  r.diasComiteJD = contar((s) => s.codigo !== CodigoIncidencia.Ninguno && esDescanso(s.incidencia));
  r.diasComiteDC = contar((s) => s.codigo !== CodigoIncidencia.Ninguno && s.incidencia === Incidencia.DC);
  r.sabadosTrabajados = dias.filter((d) => diaDeLaSemana(d.fecha) === 6 && trabaja(d)).length;
  r.sabadosDescansados = dias.filter((d) => diaDeLaSemana(d.fecha) === 6 && descansa(d)).length;
  r.domingosTrabajados = dias.filter((d) => diaDeLaSemana(d.fecha) === 0 && trabaja(d)).length;
  r.domingosDescansados = dias.filter((d) => diaDeLaSemana(d.fecha) === 0 && descansa(d)).length;
  r.festivosTrabajados = dias.filter((d) => d.esFestivo && trabaja(d)).length;
  r.festivosDescansados = dias.filter((d) => d.esFestivo && descansa(d)).length;
  r.diasTurno1 = contar((s) => s.turno === Turno.Manana);
  r.diasTurno2 = contar((s) => s.turno === Turno.Tarde);
  r.diasTurno3 = contar((s) => s.turno === Turno.Noche);
  r.diasTurno4 = contar((s) => s.turno === Turno.Partido);
  r.diasConRefuerzo = dias.filter((d) => d.refuerzos > 0).length;
  r.horasTrabajadas = dias.reduce((acc, d) => acc + d.servicioTrabajado.trabajadas, 0);
  r.horasTrabajadasConvenio = dias.reduce((acc, d) => acc + d.servicioTrabajado.trabajadasConvenio, 0);
  r.horasAcumuladas = dias.reduce((acc, d) => acc + d.servicioTrabajado.acumuladas, 0);
  r.horasNocturnas = dias.reduce((acc, d) => acc + d.servicioTrabajado.nocturnas, 0);
  r.horasAcumuladasVirtual = dias.reduce((acc, d) => acc + d.servicioVirtual.acumuladas, 0);
  r.desayunos = dias.reduce((acc, d) => acc + red2u(d.servicioTrabajado.desayuno), 0);
  r.desayunosVirtual = dias.reduce((acc, d) => acc + red2u(d.servicioVirtual.desayuno), 0);
  r.comidas = dias.reduce((acc, d) => acc + red2u(d.servicioTrabajado.comida), 0);
  r.comidasVirtual = dias.reduce((acc, d) => acc + red2u(d.servicioVirtual.comida), 0);
  r.cenas = dias.reduce((acc, d) => acc + red2u(d.servicioTrabajado.cena), 0);
  r.cenasVirtual = dias.reduce((acc, d) => acc + red2u(d.servicioVirtual.cena), 0);
  r.diasConPlusPaqueteria = contar((s) => s.tienePlusPaqueteria);
  r.facturadoPaqueteria = redCent(dias
    .filter((d) => !d.servicioTrabajado.tienePlusPaqueteria)
    .reduce((acc, d) => acc + redCent(d.servicioTrabajado.facturadoPaqueteria), 0));
  r.plusesPaqueteria = redCent(dias.reduce((acc, d) => acc + redCent(d.servicioTrabajado.plusPaqueteria), 0));
  r.limpiezas = red2u(dias.reduce((acc, d) => acc + red2u(d.servicioTrabajado.limpieza), 0));

  if (convenio === null) return;
  const año = añoDe(cal.fecha);
  const mes = mesDe(cal.fecha);
  const diasMes = diasEnMes(año, mes);

  // 12.2 Validaciones y fines de semana
  const errores: string[] = [];
  const error = (texto: string): void => { errores.push(texto); };
  r.findesCompletos = 0;
  let seguidos = 0;
  let findesSeguidos = 0;
  let findesDescanso = 0;
  let sabadoTrabajado = false;
  for (const diaObj of dias) {
    const n = diaDe(diaObj.fecha);
    const dow = diaDeLaSemana(diaObj.fecha);
    const s = diaObj.servicioTrabajado;
    if (n !== diasMes && dow === 6 && descansa(diaObj)) {
      const siguiente = dias.find((d) => diaDe(d.fecha) === n + 1);
      if (siguiente !== undefined && descansa(siguiente)) {
        r.findesCompletos += 1;
        findesDescanso++;
      }
    }
    if (n === 1 && dow === 0 && trabaja(diaObj)) findesSeguidos++;
    if (n > 1 && dow === 6 && trabaja(diaObj)) sabadoTrabajado = true;
    if (n > 1 && dow === 0) {
      if (sabadoTrabajado || trabaja(diaObj)) findesSeguidos++;
      else findesSeguidos = 0;
      sabadoTrabajado = false;
    }
    if (trabaja(diaObj)) seguidos++;
    else {
      if (seguidos > convenio.diasTrabajadosSeguidos) {
        error(`Día ${String(n).padStart(2, "0")}: Más de ${convenio.diasTrabajadosSeguidos} días trabajados.`);
      }
      seguidos = 0;
    }
    const findeOFestivo = dow === 0 || dow === 6 || diaObj.esFestivo;
    if (findeOFestivo) {
      if (s.trabajadasConvenio > convenio.jornadaMaximaFindes) {
        error(`Día ${String(n).padStart(2, "0")}: Exceso de horas trabajadas en fin de semana o festivos.`);
      }
    } else if (s.trabajadasConvenio > convenio.jornadaMaxima) {
      error(`Día ${String(n).padStart(2, "0")}: Exceso de horas trabajadas en laborables.`);
    }
    if (s.turno === Turno.Partido) {
      if (s.tiempoTotal > convenio.jornadaMaximaPartida) {
        error(`Día ${String(n).padStart(2, "0")}: Exceso de tiempo total en gráfico partido.`);
      }
      if (s.tiempoPartido > convenio.tiempoPartidoMaximo) {
        error(`Día ${String(n).padStart(2, "0")}: Exceso de tiempo partido.`);
      }
    }
  }

  const primero = dias.find((d) => diaDe(d.fecha) === 1);
  if (primero !== undefined && diaDeLaSemana(primero.fecha) === 0 && descansa(primero)
    && ultimoMesAnterior !== null && esDescanso(ultimoMesAnterior.servicioTrabajado.incidencia)) {
    r.findesCompletos += 0.5;
  }
  const ultimo = dias[dias.length - 1];
  if (ultimo !== undefined && diaDeLaSemana(ultimo.fecha) === 6 && descansa(ultimo)
    && primeroMesSiguiente !== null && esDescanso(primeroMesSiguiente.servicioTrabajado.incidencia)) {
    r.findesCompletos += 0.5;
  }

  if (contarInc(Incidencia.DS) > convenio.descansosSueltosMes) {
    error(`Más de ${convenio.descansosSueltosMes} descansos sueltos en un mes.`);
  }
  const diasDescanso = dias.filter((d) => descansa(d)).length;
  if (dias.filter((d) => trabaja(d)).length >= diasMes - 8 && diasDescanso < convenio.minimoDescansosMes) {
    error(`Menos de ${convenio.minimoDescansosMes} descansos en un mes.`);
  }
  if (diasDescanso > convenio.maximoDescansosMes) {
    error(`Más de ${convenio.maximoDescansosMes} descansos en un mes.`);
  }
  if (cal.conductor?.situacion !== SituacionTrabajador.FijoInaplicacion) {
    if (findesSeguidos > convenio.maximoFindesSeguidos) {
      error(`Más de ${convenio.maximoFindesSeguidos} fines de semana trabajados seguidos.`);
    }
    if ((mes === 7 || mes === 8 || mes === 9) && findesDescanso < 2) {
      error("Menos de dos fines de semana de descanso en un mes de verano.");
    }
  }
  r.errores = errores.join("\n");

  // 12.3 Importes
  r.importePlusPaqueteria = r.plusesPaqueteria;
  r.plusesMenorDescanso = redCent(dias.reduce((acc, d) => acc + redCent(d.servicioTrabajado.plusMenorDescanso), 0));
  r.importePlusMenorDescanso = redCent(r.plusesMenorDescanso);

  const situacion = cal.conductor?.situacion;
  const vacacionesMes = convenio.diasVacacionesAnuales / 12;
  if (situacion === SituacionTrabajador.Eventual) {
    const findesYFestivos = dias.filter((d) => esFinDeSemana(d.fecha)).length + dias.filter((d) => d.esFestivo).length;
    const proporcion = ((diasMes - vacacionesMes) * findesYFestivos) / diasMes;
    r.diasDeberiaDescansar = Math.round(((r.diasActivo * proporcion) / diasMes) * 10000) / 10000;
    r.diasDeberiaVacaciones = Math.round(((r.diasActivo * vacacionesMes) / diasMes) * 10000) / 10000;
    r.diasDeberiaTrabajar = Math.round((r.diasActivo - r.diasDeberiaDescansar - r.diasDeberiaVacaciones) * 10000) / 10000;
  } else {
    r.diasDeberiaDescansar = r.diasDeberiaVacaciones = r.diasDeberiaTrabajar = 0;
  }

  r.totalDietas = (r.desayunos * convenio.porcentajeDesayuno) / 100 + r.comidas + r.cenas;
  r.importeDietas = red2u(r.totalDietas) * convenio.importeDietas;
  r.totalDietasVirtual = (r.desayunosVirtual * convenio.porcentajeDesayuno) / 100 + r.comidasVirtual + r.cenasVirtual;
  r.importeDietasVirtual = red2u(r.totalDietasVirtual) * convenio.importeDietas;

  const sabadosNoFestivos = dias.filter((d) => diaDeLaSemana(d.fecha) === 6 && trabaja(d) && !d.esFestivo).length;
  r.importePlusSabados = sabadosNoFestivos * convenio.importePlusSabados;
  r.importePlusFestivos = (r.domingosTrabajados + r.festivosTrabajados) * convenio.importePlusFestivos;
  r.importePlusNocturnidad = r.diasTurno3 * convenio.importePlusNocturnidad;
  const nocturnasParciales = dias
    .filter((d) => d.servicioTrabajado.turno !== Turno.Noche)
    .reduce((acc, d) => acc + d.servicioTrabajado.nocturnas, 0);
  r.importePlusNocturnidadParcial = redCent(Horas.EnHoras(nocturnasParciales) * convenio.importePlusNocturnidadDiario);

  r.importePlusNavidad = 0;
  const navidad = mes === 12 ? dias.find((d) => diaDe(d.fecha) === 25) : undefined;
  const añoNuevo = mes === 1 ? dias.find((d) => diaDe(d.fecha) === 1) : undefined;
  if ((navidad !== undefined && trabaja(navidad)) || (añoNuevo !== undefined && trabaja(añoNuevo))) {
    r.importePlusNavidad = convenio.importePlusNavidad;
  }

  const tabla = convenio.tablasSalariales.find((t) => t.categoria === cal.conductor?.categoria);
  r.importeQuebrantoMoneda = totalDiasTrabajados(r) * (tabla?.precioQuebrantoMoneda ?? 0);

  const opciones = convenio.opcionesCentro.find((o) => o.centro === cal.conductor?.centro);
  if (opciones === undefined) return;

  const fijo = situacion === SituacionTrabajador.Fijo || situacion === SituacionTrabajador.FijoInaplicacion;
  let limpiezas: number;
  if (opciones.limpiezasMes > 0) {
    limpiezas = 0;
    if (totalDiasTrabajados(r) > 0) {
      if (fijo) limpiezas = Math.max(0, opciones.limpiezasMes - (r.diasE + r.diasDND + r.diasF6 + r.diasPER));
      else limpiezas = totalDiasTrabajados(r) > 21 ? convenio.maximoLimpiezas : totalDiasTrabajados(r);
    }
  } else {
    limpiezas = r.limpiezas > 21 ? convenio.maximoLimpiezas : r.limpiezas;
  }
  r.totalLimpiezas = limpiezas;
  r.importePlusLimpieza = redCent(limpiezas * convenio.importePlusLimpieza);

  r.importePlusViaje = opciones.pagarPlusViaje
    ? (totalDiasTrabajados(r) - r.diasDC - r.diasDND) * opciones.importePlusViaje
    : 0;

  const variables = r.importePlusSabados + r.importePlusFestivos + r.importePlusNocturnidad + r.importePlusLimpieza;
  r.importeVariableVacaciones = fijo
    ? red4m(variables / 11)
    : red4m(variables / 11 / 31) * r.diasDeberiaVacaciones;

  r.importeRefuerzos = r.diasConRefuerzo * convenio.importeRefuerzos;
  const precioDnd = tabla?.importeDndCobrado ?? 0;
  r.totalDndsCobrados = dias.filter((d) => d.dndCobrado).length;
  r.importeDndsCobrados = r.totalDndsCobrados * precioDnd;
  r.totalDndsCobradosPorDescanso = dias.reduce((acc, d) => acc + redCent(d.dndsCobradosPorDescanso), 0);
  r.importeDndsCobradosPorDescanso = r.totalDndsCobradosPorDescanso * precioDnd;
}

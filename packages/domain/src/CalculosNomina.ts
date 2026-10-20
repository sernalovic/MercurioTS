/**
 * Port de `Mercurio.Domain/Calculos/CalculosNomina.cs`.
 * Generación y recálculo de nóminas (REGLAS-CALCULO.md 10) e incremento de convenios (11).
 * Importes en céntimos; porcentajes 0–100; fechas "YYYY-MM-DD".
 */
import {
  Calendario, ConceptoNomina, Convenio, Nomina, TablaSalarial,
  nuevaNomina, nuevoConceptoNomina, totalDiasTrabajados,
} from "./Entidades";
import * as Horas from "./Horas";
import { CategoriaTrabajador, TipoConceptoNomina } from "./enums";
import { diasEnMes, año as añoDe, mes as mesDe } from "./Fechas";

/** Días entre dos fechas "YYYY-MM-DD" (cuenta completos, como (a-b).Days de .NET). */
function diasEntre(fechaAntiguedad: string, fecha: string): number {
  const a = Date.UTC(añoDe(fechaAntiguedad), mesDe(fechaAntiguedad) - 1, Number(fechaAntiguedad.slice(8, 10)));
  const b = Date.UTC(añoDe(fecha), mesDe(fecha) - 1, Number(fecha.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

const tramosAntiguedad: ReadonlyArray<readonly [number, number]> = [
  [10585, 0.6], [8760, 0.5], [6935, 0.4], [5110, 0.3], [3285, 0.2], [1460, 0.1], [730, 0.05],
];

export function porcentajeAntiguedad(fechaAntiguedad: string, fecha: string): number {
  const dias = diasEntre(fechaAntiguedad, fecha);
  for (const [minimo, porcentaje] of tramosAntiguedad) {
    if (dias > minimo) return porcentaje;
  }
  return 0;
}

function antiguedadDiaria(tabla: TablaSalarial, fechaAntiguedad: string, fecha: string): number {
  return (tabla.baseAntiguedad / 30) * porcentajeAntiguedad(fechaAntiguedad, fecha);
}

function textoComplemento(categoria: CategoriaTrabajador): string {
  switch (categoria) {
    case CategoriaTrabajador.Conductor: return "Plus Conductor-Perceptor";
    case CategoriaTrabajador.ConductorFormacion: return "Plus Conductor-Formación";
    case CategoriaTrabajador.Taquilla: return "Plus Taquillero";
    default: return "Complemento salarial";
  }
}

/** Último día del mes de una fecha "YYYY-MM-…", como Fecha.AddMonths(1).AddDays(-1). */
function fechaFinalDeMes(fecha: string): string {
  const y = añoDe(fecha);
  const m = mesDe(fecha);
  return `${y}-${String(m).padStart(2, "0")}-${String(diasEnMes(y, m)).padStart(2, "0")}`;
}

/** Genera la nómina mensual de un calendario (con conductor y resumen cargados). */
export function generarNomina(calendario: Calendario, convenio: Convenio): Nomina {
  const nomina = nuevaNomina();
  const conductor = calendario.conductor;
  const r = calendario.resumen;
  if (conductor === null || r === null) return nomina;
  const tabla = convenio.tablasSalariales.find((t) => t.categoria === conductor.categoria);
  const opciones = convenio.opcionesCentro.find((o) => o.centro === conductor.centro);
  if (tabla === undefined || opciones === undefined) return nomina;

  const antiguedad = antiguedadDiaria(tabla, conductor.fechaAntiguedad, calendario.fecha);
  const diasQuebranto = totalDiasTrabajados(r);

  nomina.conductorId = conductor.id ?? 0;
  nomina.fecha = nomina.fechaInicio = calendario.fecha;
  nomina.fechaFinal = fechaFinalDeMes(calendario.fecha);
  nomina.fechaAntiguedad = conductor.fechaAntiguedad;
  nomina.porcentajeSeguridadSocial = tabla.porcentajeSeguridadSocial;
  nomina.porcentajeDesempleo = tabla.porcentajeDesempleo;
  nomina.porcentajeIrpf = conductor.porcentajeIrpf;

  const concepto = (
    tipo: TipoConceptoNomina, texto: string, unidades: number, importeBase: number,
    devengado?: number, irpf = true,
  ): void => {
    nomina.conceptos.push(nuevoConceptoNomina({
      tipoConceptoNomina: tipo,
      textoConcepto: texto,
      unidades,
      importeBase,
      devengado: devengado ?? unidades * importeBase,
      computaParaIrpf: irpf,
    }));
  };

  concepto(TipoConceptoNomina.SalarioBase, "Salario base", 30, tabla.sueldoBaseMensual / 30);
  if (antiguedad > 0) concepto(TipoConceptoNomina.Antiguedad, "Antigüedad", 30, antiguedad);
  if (tabla.complementoSalarial > 0) {
    concepto(TipoConceptoNomina.ComplementoSalarial, textoComplemento(conductor.categoria), 30, tabla.complementoSalarial / 30);
  }
  if (diasQuebranto > 0) concepto(TipoConceptoNomina.QuebrantoMoneda, "Quebranto de moneda", diasQuebranto, tabla.precioQuebrantoMoneda);
  if (opciones.pagarPlusViaje && opciones.importePlusViaje > 0) {
    concepto(TipoConceptoNomina.PlusViaje, "Plus viaje", diasQuebranto, opciones.importePlusViaje);
  }
  if (r.sabadosTrabajados > 0) concepto(TipoConceptoNomina.PlusSabados, "Plus de sábados", r.sabadosTrabajados, convenio.importePlusSabados);
  if (r.importePlusFestivos > 0) {
    concepto(TipoConceptoNomina.PlusFestivos, "Plus de festivos",
      r.festivosTrabajados + r.domingosTrabajados, convenio.importePlusFestivos, r.importePlusFestivos);
  }
  if (r.totalDietas > 0) concepto(TipoConceptoNomina.Dietas, "Dietas", r.totalDietas, convenio.importeDietas);
  if (r.diasTurno3 > 0) concepto(TipoConceptoNomina.PlusNocturnidad, "Plus nocturnidad", r.diasTurno3, convenio.importePlusNocturnidad);
  const horasNocturnas = Horas.EnHoras(r.horasNocturnas);
  if (horasNocturnas > 0) {
    concepto(TipoConceptoNomina.PlusNocturnidadParcial, "Plus nocturnidad parcial", horasNocturnas, convenio.importePlusNocturnidadDiario);
  }
  if (r.importePlusPaqueteria > 0) concepto(TipoConceptoNomina.PlusPaqueteria, "Paquetería", 1, r.importePlusPaqueteria);
  if (r.totalLimpiezas > 0) concepto(TipoConceptoNomina.PlusLimpieza, "Plus limpieza", r.totalLimpiezas, convenio.importePlusLimpieza);
  if (r.plusesMenorDescanso > 0) concepto(TipoConceptoNomina.PlusMenorDescanso, "Plus por menor descanso", 1, r.importePlusMenorDescanso);
  if (r.importePlusNavidad > 0) concepto(TipoConceptoNomina.PlusNavidad, "Plus navidad", 1, convenio.importePlusNavidad);
  if (r.diasConRefuerzo > 0) concepto(TipoConceptoNomina.Refuerzos, "Refuerzos", r.diasConRefuerzo, convenio.importeRefuerzos);
  const dnds = r.totalDndsCobrados + r.totalDndsCobradosPorDescanso;
  if (dnds > 0) concepto(TipoConceptoNomina.DndsCobrados, "DNDs cobrados", dnds, tabla.importeDndCobrado);
  if (tabla.seguroAccidentes !== 0) {
    concepto(TipoConceptoNomina.SeguroAccidentes, "Seguro accidentes", 1, tabla.seguroAccidentes, undefined, false);
  }

  recalcularNomina(nomina, tabla);
  return nomina;
}

/** Actualiza la antigüedad y recalcula bases, descuentos y totales. */
export function recalcularNomina(nomina: Nomina, tabla: TablaSalarial): void {
  const antiguedad = antiguedadDiaria(tabla, nomina.fechaAntiguedad, nomina.fecha);
  const conceptoAntiguedad = nomina.conceptos.find((c) => c.tipoConceptoNomina === TipoConceptoNomina.Antiguedad);
  if (conceptoAntiguedad !== undefined) {
    conceptoAntiguedad.importeBase = antiguedad;
    conceptoAntiguedad.devengado = conceptoAntiguedad.unidades * antiguedad;
  }
  const salarioMensual = (tabla.sueldoBaseMensual / 30 + antiguedad) * 30;

  const conceptos: readonly ConceptoNomina[] = nomina.conceptos;
  nomina.baseIrpf = conceptos.filter((c) => c.computaParaIrpf).reduce((acc, c) => acc + c.devengado, 0);
  nomina.prorrateoPagas = (salarioMensual * 3 + tabla.pagaSeptiembre) / 12;
  nomina.baseSeguridadSocial = nomina.baseIrpf + nomina.prorrateoPagas;
  nomina.descuentoIrpf = (nomina.baseIrpf * nomina.porcentajeIrpf) / 100;
  nomina.descuentoSeguridadSocial = (nomina.baseSeguridadSocial * nomina.porcentajeSeguridadSocial) / 100;
  nomina.descuentoDesempleo = (nomina.baseSeguridadSocial * nomina.porcentajeDesempleo) / 100;
  nomina.totalDevengado = conceptos.reduce((acc, c) => acc + c.devengado, 0);
  nomina.totalDeducciones = conceptos.reduce((acc, c) => acc + c.deduccion, 0)
    + nomina.descuentoIrpf + nomina.descuentoSeguridadSocial + nomina.descuentoDesempleo;
  nomina.totalLiquido = nomina.totalDevengado - nomina.totalDeducciones;
}

/** Incrementa en un porcentaje los importes del convenio, sus tablas salariales y el plus viaje. */
export function incrementarImportes(c: Convenio, porcentaje: number): void {
  // Inc(v) = v + Round(v·%/100, 2); en céntimos, el redondeo a 2 decimales de euros es al céntimo entero.
  const inc = (v: number): number => v + Math.round((v * porcentaje) / 100);
  c.importeDietas = inc(c.importeDietas);
  c.importePlusSabados = inc(c.importePlusSabados);
  c.importePlusFestivos = inc(c.importePlusFestivos);
  c.importePlusMenorDescanso = inc(c.importePlusMenorDescanso);
  c.importePlusLimpieza = inc(c.importePlusLimpieza);
  c.importePlusPaqueteria = inc(c.importePlusPaqueteria);
  c.importePlusNocturnidad = inc(c.importePlusNocturnidad);
  c.importePlusNocturnidadDiario = inc(c.importePlusNocturnidadDiario);
  c.importePlusNavidad = inc(c.importePlusNavidad);
  c.importeRefuerzos = inc(c.importeRefuerzos);
  for (const t of c.tablasSalariales) {
    t.sueldoBaseDiario = inc(t.sueldoBaseDiario);
    t.sueldoBaseMensual = inc(t.sueldoBaseMensual);
    t.sueldoBaseAnual = inc(t.sueldoBaseAnual);
    t.complementoSalarial = inc(t.complementoSalarial);
    t.baseAntiguedad = inc(t.baseAntiguedad);
    t.precioQuebrantoMoneda = inc(t.precioQuebrantoMoneda);
    t.precioHoraExtra = inc(t.precioHoraExtra);
    t.pagaSeptiembre = inc(t.pagaSeptiembre);
    t.importeDndCobrado = inc(t.importeDndCobrado);
  }
  for (const o of c.opcionesCentro) o.importePlusViaje = inc(o.importePlusViaje);
}

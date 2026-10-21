/**
 * Repositorio del calendario del trabajador para el portal (port de las
 * pantallas "Calendario" y "Detalle día" de Orión 2).
 *
 * El portal edita el servicio TRABAJADO (lo real del día); el servicio ANUAL
 * (lo planificado) y el VIRTUAL no se tocan desde aquí. Los contadores del
 * resumen se vuelven a contar por situación; la recomputación completa de
 * horas/imports corresponde a los cálculos de `@mercurio/domain`
 * (TODO: port de CalculosCalendario).
 */
import { and, asc, eq } from "drizzle-orm";
import {
  aIntervalo, calendarios, diasCalendario, resumenes,
  type Calendarios, type Db, type DiasCalendario,
} from "@mercurio/db";
import { CodigoIncidencia, Incidencia, Turno } from "@mercurio/domain";

export interface DiaDeMes {
  fecha: string; // "YYYY-MM-DD"
  fila: DiasCalendario | null;
}

export interface EstadoMes {
  calendario: Calendarios | null;
  dias: DiaDeMes[];
}

/** Días del mes del trabajador, completos (los sin fila quedan como null). */
export async function estadoDelMes(
  db: Db,
  conductorId: number,
  ano: number,
  mes: number,
): Promise<EstadoMes> {
  const primero = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const [calendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, conductorId), eq(calendarios.fecha, `${primero} 00:00:00`)))
    .limit(1);

  const filas = calendario === undefined
    ? []
    : await db
      .select()
      .from(diasCalendario)
      .where(eq(diasCalendario.calendarioId, calendario.id))
      .orderBy(asc(diasCalendario.fecha));

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const porFecha = new Map(filas.map((f) => [f.fecha.slice(0, 10), f]));
  const dias: DiaDeMes[] = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = `${primero.slice(0, 8)}${String(dia).padStart(2, "0")}`;
    dias.push({ fecha, fila: porFecha.get(fecha) ?? null });
  }
  return { calendario: calendario ?? null, dias };
}

/** Un día concreto con su calendario; null si la fila del mes no existe. */
export async function diaConcreto(
  db: Db,
  conductorId: number,
  ano: number,
  mes: number,
  dia: number,
): Promise<{ calendario: Calendarios; fila: DiasCalendario | null; fecha: string } | null> {
  const primero = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const [calendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, conductorId), eq(calendarios.fecha, `${primero} 00:00:00`)))
    .limit(1);
  if (calendario === undefined) return null;

  const fecha = `${primero.slice(0, 8)}${String(dia).padStart(2, "0")}`;
  const [fila] = await db
    .select()
    .from(diasCalendario)
    .where(and(eq(diasCalendario.calendarioId, calendario.id), eq(diasCalendario.fecha, `${fecha} 00:00:00`)))
    .limit(1);
  return { calendario, fila: fila ?? null, fecha };
}

export interface DatosDia {
  incidencia: Incidencia;
  codigo: CodigoIncidencia;
  turno: Turno;
  numero: number;
  inicio: number | null; // minutos desde medianoche
  final: number | null;
  inicioPartido: number | null;
  finalPartido: number | null;
  facturadoPaqueteria: number; // céntimos
  limpieza: number; // unidades
  vehiculos: string | null;
  refuerzos: number;
  dndCobrado: boolean;
  notas: string | null;
}

const INTERVALO_CERO = "00:00:00";

/** Contadores a cero del resumen cuando nace un calendario nuevo. */
function resumenEnBlanco(calendarioId: number, ahora: string, usuarioId: number): typeof resumenes.$inferInsert {
  return {
    calendarioId,
    modifiedDate: ahora,
    modifiedBy: usuarioId,
    diasActivo: 0, diasInactivo: 0, diasTrabajo: 0, diasTrabajoJD: 0, diasTrabajoFN: 0,
    diasOV: 0, diasJD: 0, diasFN: 0, diasE: 0, diasDS: 0, diasDC: 0, diasF6: 0,
    diasF6D: 0, diasDND: 0, diasDF: 0, diasPER: 0, diasEJD: 0, diasEFN: 0,
    diasOVJD: 0, diasOVFN: 0, diasF6DC: 0, diasFOR: 0, diasFORJD: 0, diasFORFN: 0,
    diasOVA: 0, diasOVAJD: 0, diasOVAFN: 0, diasLAC: 0, diasLACJD: 0, diasLACFN: 0,
    diasCO: 0, diasCE: 0, diasRE: 0, diasHorasSindicales: 0, diasComiteJD: 0, diasComiteDC: 0,
    sabadosTrabajados: 0, sabadosDescansados: 0, domingosTrabajados: 0, domingosDescansados: 0,
    festivosTrabajados: 0, festivosDescansados: 0, diasTurno1: 0, diasTurno2: 0, diasTurno3: 0,
    diasTurno4: 0, diasConRefuerzo: 0,
    findesCompletos: "0", diasDeberiaTrabajar: "0", diasDeberiaDescansar: "0", diasDeberiaVacaciones: "0",
    horasTrabajadas: INTERVALO_CERO, horasTrabajadasConvenio: INTERVALO_CERO, horasAcumuladas: INTERVALO_CERO,
    horasAcumuladasVirtual: INTERVALO_CERO, horasNocturnas: INTERVALO_CERO,
    desayunos: "0", desayunosVirtual: "0", comidas: "0", comidasVirtual: "0", cenas: "0", cenasVirtual: "0",
    totalDietas: "0", totalDietasVirtual: "0", diasConPlusPaqueteria: 0, facturadoPaqueteria: "0",
    plusesPaqueteria: "0", plusesMenorDescanso: "0", limpiezas: "0", totalLimpiezas: "0",
    importeDietas: "0", importeDietasVirtual: "0", importePlusSabados: "0", importePlusFestivos: "0",
    importePlusPaqueteria: "0", importePlusLimpieza: "0", importePlusMenorDescanso: "0",
    importePlusNocturnidad: "0", importePlusNocturnidadParcial: "0", importePlusNavidad: "0",
    importePlusViaje: "0", importeQuebrantoMoneda: "0", importeVariableVacaciones: "0",
    importeRefuerzos: "0", errores: "", totalDndsCobrados: 0, importeDndsCobrados: "0",
    totalDndsCobradosPorDescanso: "0", importeDndsCobradosPorDescanso: "0",
  };
}

/**
 * Guarda el detalle del día (desde la Server Action). Crea el calendario del
 * mes y la fila del día si no existían, escribe el servicio TRABAJADO y
 * reencuentra los contadores de situaciones del resumen.
 */
export async function guardarDia(
  db: Db,
  args: {
    usuarioId: number;
    conductorId: number;
    ano: number;
    mes: number;
    dia: number;
    datos: DatosDia;
  },
): Promise<void> {
  const { datos } = args;
  const esTrabajo =
    datos.incidencia === Incidencia.Trabajo ||
    datos.incidencia === Incidencia.TrabajoJD ||
    datos.incidencia === Incidencia.TrabajoFN;
  // Los descansos no llevan gráfico, turno ni horas.
  const numero = esTrabajo ? datos.numero : 0;
  const turno = esTrabajo ? datos.turno : Turno.SinTurno;
  const inicio = esTrabajo ? datos.inicio : null;
  const final = esTrabajo ? datos.final : null;
  const inicioPartido = esTrabajo ? datos.inicioPartido : null;
  const finalPartido = esTrabajo ? datos.finalPartido : null;

  // Duración simple del tramo: final - inicio (menos la pausa del partido).
  // TODO: la valoración completa es trabajo de CalculosHorario (a portar).
  let trabajadas = 0;
  if (inicio !== null && final !== null) {
    trabajadas = Math.max(0, final - inicio);
    if (inicioPartido !== null && finalPartido !== null) {
      trabajadas = Math.max(0, trabajadas - Math.max(0, finalPartido - final) - Math.max(0, inicio - inicioPartido));
    }
  }

  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  // ---- Calendario del mes (con resumen en blanco si falta) ----
  const primero = `${args.ano}-${String(args.mes).padStart(2, "0")}-01 00:00:00`;
  let [calendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, args.conductorId), eq(calendarios.fecha, primero)))
    .limit(1);
  if (calendario === undefined) {
    const creado = await db.insert(calendarios).values({
      conductorId: args.conductorId,
      centro: 1,
      fecha: primero,
      totalImportePlusSabados: "0", totalImportePlusFestivos: "0", totalImportePlusNocturnidad: "0",
      totalImportePlusNocturnidadParcial: "0", totalImportePlusPaqueteria: "0", totalImportePlusLimpieza: "0",
      totalImportePlusMenorDescanso: "0", totalImportePlusNavidad: "0", totalImportePlusViaje: "0",
      totalQuebrantoMoneda: "0", totalRefuerzos: "0", totalImporteDietas: "0",
      totalDcsPendientes: "0", totalDndsPendientes: "0", totalImporteDndsCobrados: "0",
      modifiedDate: ahora, modifiedBy: args.usuarioId,
    }).returning();
    calendario = creado[0];
    await db.insert(resumenes).values(resumenEnBlanco(calendario.id, ahora, args.usuarioId));
  }

  // ---- Fila del día (upsert) ----
  const fecha = `${args.ano}-${String(args.mes).padStart(2, "0")}-${String(args.dia).padStart(2, "0")}`;
  const [existente] = await db
    .select()
    .from(diasCalendario)
    .where(and(eq(diasCalendario.calendarioId, calendario.id), eq(diasCalendario.fecha, `${fecha} 00:00:00`)))
    .limit(1);

  const servicioTrabajado = {
    incidencia: datos.incidencia,
    codigo: datos.codigo,
    categoria: 0,
    numero,
    tipoDia: 0,
    turno,
    inicio: inicio === null ? null : aIntervalo(inicio),
    final: final === null ? null : aIntervalo(final),
    inicioPartido: inicioPartido === null ? null : aIntervalo(inicioPartido),
    finalPartido: finalPartido === null ? null : aIntervalo(finalPartido),
    valoracion: aIntervalo(trabajadas),
    tiempoTotal: aIntervalo(trabajadas),
    trabajadas: aIntervalo(trabajadas),
    trabajadasConvenio: aIntervalo(trabajadas),
    facturadoPaqueteria: (datos.facturadoPaqueteria / 100).toFixed(2),
    limpieza: String(datos.limpieza),
  };

  const cambios: Partial<typeof diasCalendario.$inferInsert> = {
    refuerzos: datos.refuerzos,
    notas: datos.notas !== null && datos.notas.trim() === "" ? null : datos.notas,
    vehiculos: datos.vehiculos !== null && datos.vehiculos.trim() === "" ? null : datos.vehiculos,
    dndCobrado: datos.dndCobrado,
    isRemoteUpdated: true,
    modifiedDate: ahora,
    modifiedBy: args.usuarioId,
    TrabajadoIncidencia: servicioTrabajado.incidencia,
    TrabajadoCodigo: servicioTrabajado.codigo,
    TrabajadoCategoria: servicioTrabajado.categoria,
    TrabajadoNumero: servicioTrabajado.numero,
    TrabajadoTipoDia: servicioTrabajado.tipoDia,
    TrabajadoTurno: servicioTrabajado.turno,
    TrabajadoInicio: servicioTrabajado.inicio,
    TrabajadoFinal: servicioTrabajado.final,
    TrabajadoInicioPartido: servicioTrabajado.inicioPartido,
    TrabajadoFinalPartido: servicioTrabajado.finalPartido,
    TrabajadoValoracion: servicioTrabajado.valoracion,
    TrabajadoTiempoTotal: servicioTrabajado.tiempoTotal,
    TrabajadoTrabajadas: servicioTrabajado.trabajadas,
    TrabajadoTrabajadasConvenio: servicioTrabajado.trabajadasConvenio,
    TrabajadoFacturadoPaqueteria: servicioTrabajado.facturadoPaqueteria,
    TrabajadoLimpieza: servicioTrabajado.limpieza,
  };

  if (existente === undefined) {
    // Alta: la fila completa con Anual/Virtual (y el resto de Trabajado) en blanco.
    const alta: typeof diasCalendario.$inferInsert = {
      calendarioId: calendario.id,
      fecha: `${fecha} 00:00:00`,
      esFestivo: false,
      refuerzos: datos.refuerzos,
      notas: cambios.notas ?? null,
      vehiculos: cambios.vehiculos ?? null,
      dndCobrado: datos.dndCobrado,
      dndsCobradosPorDescanso: "0",
      isRemoteUpdated: true,
      modifiedDate: ahora,
      modifiedBy: args.usuarioId,
      ...bloqueAnualEnBlanco(),
      ...bloqueVirtualEnBlanco(),
      TrabajadoIncidencia: servicioTrabajado.incidencia,
      TrabajadoCodigo: servicioTrabajado.codigo,
      TrabajadoCategoria: servicioTrabajado.categoria,
      TrabajadoNumero: servicioTrabajado.numero,
      TrabajadoTipoDia: servicioTrabajado.tipoDia,
      TrabajadoTurno: servicioTrabajado.turno,
      TrabajadoInicio: servicioTrabajado.inicio,
      TrabajadoFinal: servicioTrabajado.final,
      TrabajadoInicioPartido: servicioTrabajado.inicioPartido,
      TrabajadoFinalPartido: servicioTrabajado.finalPartido,
      TrabajadoValoracion: servicioTrabajado.valoracion,
      TrabajadoTiempoTotal: servicioTrabajado.tiempoTotal,
      TrabajadoTiempoPartido: INTERVALO_CERO,
      TrabajadoTrabajadas: servicioTrabajado.trabajadas,
      TrabajadoTrabajadasConvenio: servicioTrabajado.trabajadasConvenio,
      TrabajadoTiempoVacio: INTERVALO_CERO,
      TrabajadoAcumuladas: INTERVALO_CERO,
      TrabajadoNocturnas: INTERVALO_CERO,
      TrabajadoDesayuno: "0",
      TrabajadoComida: "0",
      TrabajadoCena: "0",
      TrabajadoTienePlusPaqueteria: false,
      TrabajadoPlusPaqueteria: "0",
      TrabajadoPlusMenorDescanso: "0",
      TrabajadoNoCalcular: false,
      TrabajadoFacturadoPaqueteria: servicioTrabajado.facturadoPaqueteria,
      TrabajadoLimpieza: servicioTrabajado.limpieza,
    };
    await db.insert(diasCalendario).values(alta);
  } else {
    await db.update(diasCalendario).set(cambios).where(eq(diasCalendario.id, existente.id));
  }

  // ---- Resumen del mes: reconteo de días por situación ----
  const filas = await db
    .select({ incidencia: diasCalendario.TrabajadoIncidencia })
    .from(diasCalendario)
    .where(eq(diasCalendario.calendarioId, calendario.id));
  const conteo = new Map<Incidencia, number>();
  for (const f of filas) conteo.set(f.incidencia, (conteo.get(f.incidencia) ?? 0) + 1);
  const CONTADORES: Array<[keyof typeof resumenes.$inferInsert, Incidencia]> = [
    ["diasTrabajo", Incidencia.Trabajo], ["diasTrabajoJD", Incidencia.TrabajoJD],
    ["diasTrabajoFN", Incidencia.TrabajoFN], ["diasJD", Incidencia.JD], ["diasFN", Incidencia.FN],
    ["diasDS", Incidencia.DS], ["diasDC", Incidencia.DC], ["diasDND", Incidencia.DND],
    ["diasF6", Incidencia.F6], ["diasF6D", Incidencia.F6D], ["diasF6DC", Incidencia.F6DC],
    ["diasPER", Incidencia.PER], ["diasDF", Incidencia.DF],
    ["diasOV", Incidencia.OV], ["diasOVJD", Incidencia.OVJD], ["diasOVFN", Incidencia.OVFN],
    ["diasE", Incidencia.E], ["diasEJD", Incidencia.EJD], ["diasEFN", Incidencia.EFN],
    ["diasFOR", Incidencia.FOR], ["diasFORJD", Incidencia.FORJD], ["diasFORFN", Incidencia.FORFN],
  ];
  const parche: Record<string, number> = {};
  for (const [campo, incidencia] of CONTADORES) parche[campo as string] = conteo.get(incidencia) ?? 0;

  await db.update(resumenes)
    .set(parche as Partial<typeof resumenes.$inferInsert>)
    .where(eq(resumenes.calendarioId, calendario.id));
}

/**
 * Bloques de un servicio (Anual/Virtual) recién creado, todo en blanco.
 * Claves literales para que drizzle las cuente en `$inferInsert`.
 */
function bloqueAnualEnBlanco() {
  return {
    AnualIncidencia: Incidencia.Inactivo,
    AnualCodigo: CodigoIncidencia.Ninguno,
    AnualCategoria: 0,
    AnualNumero: 0,
    AnualTipoDia: 0,
    AnualTurno: 0,
    AnualPlusPaqueteria: "0",
    AnualFacturadoPaqueteria: "0",
    AnualLimpieza: "0",
    AnualPlusMenorDescanso: "0",
    AnualNoCalcular: false,
    AnualInicio: null,
    AnualFinal: null,
    AnualInicioPartido: null,
    AnualFinalPartido: null,
    AnualValoracion: INTERVALO_CERO,
    AnualTiempoTotal: INTERVALO_CERO,
    AnualTiempoPartido: INTERVALO_CERO,
    AnualTrabajadas: INTERVALO_CERO,
    AnualTrabajadasConvenio: INTERVALO_CERO,
    AnualTiempoVacio: INTERVALO_CERO,
    AnualAcumuladas: INTERVALO_CERO,
    AnualNocturnas: INTERVALO_CERO,
    AnualDesayuno: "0",
    AnualComida: "0",
    AnualCena: "0",
    AnualTienePlusPaqueteria: false,
  };
}

function bloqueVirtualEnBlanco() {
  return {
    VirtualIncidencia: Incidencia.Inactivo,
    VirtualCodigo: CodigoIncidencia.Ninguno,
    VirtualCategoria: 0,
    VirtualNumero: 0,
    VirtualTipoDia: 0,
    VirtualTurno: 0,
    VirtualPlusPaqueteria: "0",
    VirtualFacturadoPaqueteria: "0",
    VirtualLimpieza: "0",
    VirtualPlusMenorDescanso: "0",
    VirtualNoCalcular: false,
    VirtualInicio: null,
    VirtualFinal: null,
    VirtualInicioPartido: null,
    VirtualFinalPartido: null,
    VirtualValoracion: INTERVALO_CERO,
    VirtualTiempoTotal: INTERVALO_CERO,
    VirtualTiempoPartido: INTERVALO_CERO,
    VirtualTrabajadas: INTERVALO_CERO,
    VirtualTrabajadasConvenio: INTERVALO_CERO,
    VirtualTiempoVacio: INTERVALO_CERO,
    VirtualAcumuladas: INTERVALO_CERO,
    VirtualNocturnas: INTERVALO_CERO,
    VirtualDesayuno: "0",
    VirtualComida: "0",
    VirtualCena: "0",
    VirtualTienePlusPaqueteria: false,
  };
}

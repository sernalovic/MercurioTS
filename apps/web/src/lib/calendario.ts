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
import { and, asc, eq, gte, lt } from "drizzle-orm";
import {
  aIntervalo, aNumero, calendarioDesdeFila, calendarios, conductorDesdeFila,
  convenioDesdeFilas, diaDesdeFila, resumenAFila, resumenDesdeFila,
  servicioTrabajadoAColumnas, convenios, opcionesCentro, festivos, tablasSalariales,
  conceptosReclamados, conductores, diasCalendario, regulaciones, reclamaciones, resumenes,
  type Calendarios, type Db, type DiasCalendario,
} from "@mercurio/db";
import {
  CalculosHorario, CodigoIncidencia, Incidencia, recalcularResumen as recalcularResumenDominio,
  TipoReclamacion, Turno,
  type Conductor, type Convenio, type Servicio,
} from "@mercurio/domain";

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

  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  const calendario = await asegurarCalendarioDelMes(db, args.conductorId, args.ano, args.mes, args.usuarioId, ahora);

  // ---- Valoración completa del servicio con CalculosHorario ----
  // Trabajadas (con el tope del partido), trabajadas según convenio,
  // acumuladas, nocturnas, dietas y plus de paquetería salen del dominio
  // (REGLAS-CALCULO.md 1–5); sin convenio del año, todo queda a cero.
  const servicio: Servicio = {
    incidencia: datos.incidencia,
    codigo: datos.codigo,
    plusPaqueteria: 0,
    facturadoPaqueteria: datos.facturadoPaqueteria,
    limpieza: datos.limpieza,
    plusMenorDescanso: 0,
    noCalcular: false,
    categoria: 0,
    numero,
    tipoDia: 0,
    turno,
    inicio: esTrabajo ? datos.inicio : null,
    final: esTrabajo ? datos.final : null,
    inicioPartido: esTrabajo ? datos.inicioPartido : null,
    finalPartido: esTrabajo ? datos.finalPartido : null,
    valoracion: 0,
    tiempoTotal: 0,
    tiempoPartido: 0,
    trabajadas: 0,
    trabajadasConvenio: 0,
    tiempoVacio: 0,
    acumuladas: 0,
    nocturnas: 0,
    desayuno: 0,
    comida: 0,
    cena: 0,
    tienePlusPaqueteria: false,
  };
  new CalculosHorario(await convenioDelAño(db, args.ano)).recalcularServicio(servicio);
  // La columna Valoración sigue reflejando la duración útil del tramo.
  servicio.valoracion = servicio.trabajadas;

  // ---- Fila del día (upsert) ----
  const fecha = `${args.ano}-${String(args.mes).padStart(2, "0")}-${String(args.dia).padStart(2, "0")}`;
  const [existente] = await db
    .select()
    .from(diasCalendario)
    .where(and(eq(diasCalendario.calendarioId, calendario.id), eq(diasCalendario.fecha, `${fecha} 00:00:00`)))
    .limit(1);

  const cambios: Partial<typeof diasCalendario.$inferInsert> = {
    refuerzos: datos.refuerzos,
    notas: datos.notas !== null && datos.notas.trim() === "" ? null : datos.notas,
    vehiculos: datos.vehiculos !== null && datos.vehiculos.trim() === "" ? null : datos.vehiculos,
    dndCobrado: datos.dndCobrado,
    isRemoteUpdated: true,
    modifiedDate: ahora,
    modifiedBy: args.usuarioId,
    ...servicioTrabajadoAColumnas(servicio),
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
      ...servicioTrabajadoAColumnas(servicio),
      TrabajadoIncidencia: servicio.incidencia,
      TrabajadoCodigo: servicio.codigo,
      TrabajadoTurno: servicio.turno,
    };
    await db.insert(diasCalendario).values(alta);
  } else {
    await db.update(diasCalendario).set(cambios).where(eq(diasCalendario.id, existente.id));
  }

  // ---- Resumen del mes: recálculo completo (contadores e importes) ----
  await recalcularResumenMes(db, {
    conductorId: args.conductorId, ano: args.ano, mes: args.mes,
    usuarioId: args.usuarioId, ahora, calendarioId: calendario.id,
  });
}

/** Devuelve el calendario del mes, creándolo con resumen en blanco si falta. */
export async function asegurarCalendarioDelMes(
  db: Db,
  conductorId: number,
  ano: number,
  mes: number,
  usuarioId: number,
  ahora: string,
) {
  const primero = `${ano}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const [calendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, conductorId), eq(calendarios.fecha, primero)))
    .limit(1);
  if (calendario !== undefined) return calendario;

  const creado = await db.insert(calendarios).values({
    conductorId,
    centro: 1,
    fecha: primero,
    totalImportePlusSabados: "0", totalImportePlusFestivos: "0", totalImportePlusNocturnidad: "0",
    totalImportePlusNocturnidadParcial: "0", totalImportePlusPaqueteria: "0", totalImportePlusLimpieza: "0",
    totalImportePlusMenorDescanso: "0", totalImportePlusNavidad: "0", totalImportePlusViaje: "0",
    totalQuebrantoMoneda: "0", totalRefuerzos: "0", totalImporteDietas: "0",
    totalDcsPendientes: "0", totalDndsPendientes: "0", totalImporteDndsCobrados: "0",
    modifiedDate: ahora, modifiedBy: usuarioId,
  }).returning();
  await db.insert(resumenes).values(resumenEnBlanco(creado[0].id, ahora, usuarioId));
  return creado[0];
}

/** Convenio vigente en el año del mes (null si no hay fila para ese año). */
export async function convenioDelAño(db: Db, ano: number): Promise<Convenio | null> {
  const [fila] = await db.select().from(convenios).where(eq(convenios.año, ano)).limit(1);
  if (fila === undefined) return null;
  const [filasOpciones, filasFestivos, filasTablas] = await Promise.all([
    db.select().from(opcionesCentro),
    db.select().from(festivos),
    db.select().from(tablasSalariales),
  ]);
  return convenioDesdeFilas(fila, filasOpciones, filasFestivos, filasTablas);
}

/** Conductor del dominio con sus regulaciones (null si no existe la fila). */
export async function conductorDominio(db: Db, conductorId: number): Promise<Conductor | null> {
  const [fila] = await db.select().from(conductores).where(eq(conductores.id, conductorId)).limit(1);
  if (fila === undefined) return null;
  const regs = await db.select().from(regulaciones).where(eq(regulaciones.conductorId, conductorId));
  return conductorDesdeFila(fila, regs);
}

/**
 * Recalcula el resumen del mes con los cálculos completos del dominio
 * (REGLAS-CALCULO.md 12: contadores, validaciones, importes) y escribe la
 * fila. Los días de frontera salen de los calendarios de los meses contiguos;
 * si no existe fila, el dominio no suma el medio finde (igual que el original,
 * `DiasVecinosAsync` devuelve null y no hay bonus).
 */
export async function recalcularResumenMes(
  db: Db,
  args: { conductorId: number; ano: number; mes: number; usuarioId: number; ahora: string; calendarioId: number },
): Promise<void> {
  const filasDias = await db
    .select()
    .from(diasCalendario)
    .where(eq(diasCalendario.calendarioId, args.calendarioId))
    .orderBy(asc(diasCalendario.fecha));
  const [filaResumen] = await db
    .select()
    .from(resumenes)
    .where(eq(resumenes.calendarioId, args.calendarioId))
    .limit(1);

  const anteriorALAño = args.mes === 1 ? args.ano - 1 : args.ano;
  const anteriorALMes = args.mes === 1 ? 12 : args.mes - 1;
  const diaAStr = (d: number) => String(d).padStart(2, "0");
  const ultimoMesAnterior = anteriorALMes === 12 ? 31 : new Date(args.ano, args.mes - 1, 0).getDate();
  const fechaAnterior = `${anteriorALAño}-${diaAStr(anteriorALMes)}-${diaAStr(ultimoMesAnterior)} 00:00:00`;
  const siguienteAño = args.mes === 12 ? args.ano + 1 : args.ano;
  const siguienteMes = args.mes === 12 ? 1 : args.mes + 1;
  const fechaSiguiente = `${siguienteAño}-${diaAStr(siguienteMes)}-01 00:00:00`;
  const filaFrontera = async (fecha: string): Promise<DiasCalendario | null> => {
    const [fila] = await db
      .select({ fila: diasCalendario })
      .from(diasCalendario)
      .innerJoin(calendarios, eq(diasCalendario.calendarioId, calendarios.id))
      .where(and(eq(calendarios.conductorId, args.conductorId), eq(diasCalendario.fecha, fecha)))
      .limit(1);
    return fila?.fila ?? null;
  };

  const [calendarioFila] = await db.select().from(calendarios).where(eq(calendarios.id, args.calendarioId)).limit(1);
  if (calendarioFila === undefined) throw new Error("Calendario del mes no encontrado.");
  const [filaPrev, filaSig] = await Promise.all([filaFrontera(fechaAnterior), filaFrontera(fechaSiguiente)]);
  const cal = calendarioDesdeFila(
    calendarioFila,
    filasDias,
    filaResumen === undefined ? null : resumenDesdeFila(filaResumen),
    await conductorDominio(db, args.conductorId),
  );
  recalcularResumenDominio(
    cal,
    await convenioDelAño(db, args.ano),
    filaPrev === null ? null : diaDesdeFila(filaPrev),
    filaSig === null ? null : diaDesdeFila(filaSig),
  );
  const resumen = cal.resumen;
  if (resumen === null) return;

  if (filaResumen === undefined) {
    await db.insert(resumenes).values({
      ...resumenAFila(resumen),
      modifiedDate: args.ahora,
      modifiedBy: args.usuarioId,
    });
  } else {
    await db.update(resumenes)
      .set({
        ...resumenAFila(resumen),
        modifiedDate: args.ahora,
        modifiedBy: args.usuarioId,
      })
      .where(eq(resumenes.calendarioId, args.calendarioId));
  }
}

export interface DatosDiaPijama {
  incidencia: Incidencia;
  codigo: CodigoIncidencia;
  numero: number;
  acumuladas: number | null; // minutos
  desayuno: number; // unidades
  comida: number;
  cena: number;
}

/**
 * Guarda el detalle del día del PIJAMA: solo situación, gráfico, comité,
 * horas acumuladas y dietas. No toca turno ni horarios (esos son del
 * calendario); los descansos sí pierden el número de gráfico.
 */
export async function guardarDiaPijama(
  db: Db,
  args: {
    usuarioId: number;
    conductorId: number;
    ano: number;
    mes: number;
    dia: number;
    datos: DatosDiaPijama;
  },
): Promise<void> {
  const { datos } = args;
  const esTrabajo =
    datos.incidencia === Incidencia.Trabajo ||
    datos.incidencia === Incidencia.TrabajoJD ||
    datos.incidencia === Incidencia.TrabajoFN;

  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  const calendario = await asegurarCalendarioDelMes(db, args.conductorId, args.ano, args.mes, args.usuarioId, ahora);

  const fecha = `${args.ano}-${String(args.mes).padStart(2, "0")}-${String(args.dia).padStart(2, "0")}`;
  const [existente] = await db
    .select()
    .from(diasCalendario)
    .where(and(eq(diasCalendario.calendarioId, calendario.id), eq(diasCalendario.fecha, `${fecha} 00:00:00`)))
    .limit(1);

  // Campos propios del pijama (el resto de Trabajado se conserva): situación
  // + gráfico, acumuladas y dietas que el trabajador introduce a mano.
  const acumuladasTexto = datos.acumuladas === null ? INTERVALO_CERO : aIntervalo(datos.acumuladas);
  const cambiosPijama: Partial<typeof diasCalendario.$inferInsert> = {
    TrabajadoIncidencia: datos.incidencia,
    TrabajadoCodigo: datos.codigo,
    TrabajadoNumero: esTrabajo ? datos.numero : 0,
    TrabajadoAcumuladas: acumuladasTexto,
    TrabajadoDesayuno: String(datos.desayuno),
    TrabajadoComida: String(datos.comida),
    TrabajadoCena: String(datos.cena),
    isRemoteUpdated: true,
    modifiedDate: ahora,
    modifiedBy: args.usuarioId,
  };
  if (existente === undefined) {
    // Alta: fila completa con Anual/Virtual en blanco y el resto de Trabajado vacío.
    const alta: typeof diasCalendario.$inferInsert = {
      ...filaDiaEnBlanco(calendario.id, `${fecha} 00:00:00`, ahora, args.usuarioId),
      ...cambiosPijama,
    };
    await db.insert(diasCalendario).values(alta);
  } else {
    await db.update(diasCalendario).set(cambiosPijama).where(eq(diasCalendario.id, existente.id));
  }

  await recalcularResumenMes(db, {
    conductorId: args.conductorId, ano: args.ano, mes: args.mes,
    usuarioId: args.usuarioId, ahora, calendarioId: calendario.id,
  });
}

/** Fila completa de un día recién creado, con los tres servicios en blanco. */
function filaDiaEnBlanco(
  calendarioId: number,
  fecha: string,
  ahora: string,
  usuarioId: number,
): typeof diasCalendario.$inferInsert {
  return {
    calendarioId,
    fecha,
    esFestivo: false,
    refuerzos: 0,
    notas: null,
    vehiculos: null,
    dndCobrado: false,
    dndsCobradosPorDescanso: "0",
    isRemoteUpdated: false,
    modifiedDate: ahora,
    modifiedBy: usuarioId,
    ...bloqueAnualEnBlanco(),
    ...bloqueVirtualEnBlanco(),
    TrabajadoIncidencia: Incidencia.Inactivo,
    TrabajadoCodigo: CodigoIncidencia.Ninguno,
    TrabajadoCategoria: 0,
    TrabajadoNumero: 0,
    TrabajadoTipoDia: 0,
    TrabajadoTurno: Turno.SinTurno,
    TrabajadoInicio: null,
    TrabajadoFinal: null,
    TrabajadoInicioPartido: null,
    TrabajadoFinalPartido: null,
    TrabajadoValoracion: INTERVALO_CERO,
    TrabajadoTiempoTotal: INTERVALO_CERO,
    TrabajadoTiempoPartido: INTERVALO_CERO,
    TrabajadoTrabajadas: INTERVALO_CERO,
    TrabajadoTrabajadasConvenio: INTERVALO_CERO,
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
    TrabajadoFacturadoPaqueteria: "0",
    TrabajadoLimpieza: "0",
  };
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

export interface DatosImportes {
  sabados: number; // euros
  festivos: number;
  nocturnidad: number;
  nocturnidadParcial: number;
  paqueteria: number;
  limpieza: number;
  menorDescanso: number;
  navidad: number;
  viaje: number;
  quebranto: number;
  dietas: number;
  refuerzos: number;
  dndsCobrados: number;
}

/** Fila de importes del mes (o null si aún no hay calendario del mes). */
export async function importesDelMes(
  db: Db,
  conductorId: number,
  ano: number,
  mes: number,
) {
  const primero = `${ano}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const [calendario] = await db
    .select()
    .from(calendarios)
    .where(and(eq(calendarios.conductorId, conductorId), eq(calendarios.fecha, primero)))
    .limit(1);
  return calendario ?? null;
}

/**
 * Guarda los importes en nómina del mes (pantalla "Importes en nómina"):
 * pega los totales tal cual los introduce el trabajador, creando el
 * calendario del mes si falta. No toca días ni resumen.
 */
export async function guardarImportes(
  db: Db,
  args: {
    usuarioId: number;
    conductorId: number;
    ano: number;
    mes: number;
    datos: DatosImportes;
  },
): Promise<void> {
  const d = args.datos;
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  await asegurarCalendarioDelMes(db, args.conductorId, args.ano, args.mes, args.usuarioId, ahora);

  const primero = `${args.ano}-${String(args.mes).padStart(2, "0")}-01 00:00:00`;
  await db.update(calendarios)
    .set({
      totalImportePlusSabados: String(d.sabados),
      totalImportePlusFestivos: String(d.festivos),
      totalImportePlusNocturnidad: String(d.nocturnidad),
      totalImportePlusNocturnidadParcial: String(d.nocturnidadParcial),
      totalImportePlusPaqueteria: String(d.paqueteria),
      totalImportePlusLimpieza: String(d.limpieza),
      totalImportePlusMenorDescanso: String(d.menorDescanso),
      totalImportePlusNavidad: String(d.navidad),
      totalImportePlusViaje: String(d.viaje),
      totalQuebrantoMoneda: String(d.quebranto),
      totalImporteDietas: String(d.dietas),
      totalRefuerzos: String(d.refuerzos),
      totalImporteDndsCobrados: String(d.dndsCobrados),
      modifiedDate: ahora,
      modifiedBy: args.usuarioId,
    })
    .where(and(eq(calendarios.conductorId, args.conductorId), eq(calendarios.fecha, primero)));
}

export interface ValorAnual {
  dia: number; // 1..31
  incidencia: Incidencia;
  numero: number; // gráfico (solo variantes de trabajo)
}

/**
 * Guarda el calendario anual del mes (pantalla "Calendario anual"): la
 * situación y el gráfico ANUALES de cada día. No toca el Trabajado ni el
 * Virtual; las casillas en blanco vacían el día solo si la fila existe.
 */
export async function guardarCalendarioAnual(
  db: Db,
  args: {
    usuarioId: number;
    conductorId: number;
    ano: number;
    mes: number;
    valores: ValorAnual[];
  },
): Promise<void> {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  const calendario = await asegurarCalendarioDelMes(db, args.conductorId, args.ano, args.mes, args.usuarioId, ahora);
  const filas = await db.select().from(diasCalendario)
    .where(eq(diasCalendario.calendarioId, calendario.id));
  const porDia = new Map(filas.map((f) => [Number(f.fecha.slice(8, 10)), f]));

  for (const v of args.valores) {
    if (v.dia < 1 || v.dia > 31) continue;
    const numero = v.incidencia === Incidencia.Trabajo || v.incidencia === Incidencia.TrabajoJD
      || v.incidencia === Incidencia.TrabajoFN ? v.numero : 0;
    const existente = porDia.get(v.dia);
    if (existente !== undefined) {
      await db.update(diasCalendario).set({
        AnualIncidencia: v.incidencia,
        AnualNumero: numero,
        modifiedDate: ahora,
        modifiedBy: args.usuarioId,
      }).where(eq(diasCalendario.id, existente.id));
    } else if (v.incidencia !== Incidencia.Inactivo) {
      const fecha = `${args.ano}-${String(args.mes).padStart(2, "0")}-${String(v.dia).padStart(2, "0")}`;
      await db.insert(diasCalendario).values({
        ...filaDiaEnBlanco(calendario.id, `${fecha} 00:00:00`, ahora, args.usuarioId),
        AnualIncidencia: v.incidencia,
        AnualNumero: numero,
      });
    }
  }
}

/**
 * "Guardar DCs y DNDs" (Pijama): recalcula el saldo de DCs y DNDs pendientes
 * del mes (REGLAS-CALCULO.md 15) y lo guarda en TotalDcsPendientes /
 * TotalDndsPendientes. Los descansos los coloca el trabajador desde el
 * detalle del día del Calendario (situación DC, F6DC, DND o DF del servicio
 * Trabajado); también se restan generados por JD (comité, trabajo, FOR) y
 * los DNDs cobrados, y los reclamados en reclamaciones aún en curso.
 */
export async function guardarDcsYDnds(
  db: Db,
  args: { usuarioId: number; conductorId: number; ano: number; mes: number },
): Promise<{ dcs: number; dnds: number }> {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  // Recalculamos el resumen del mes (contadores e importes del dominio) para
  // que los JD/DC/DND recién colocados cuenten.
  const calendario = await asegurarCalendarioDelMes(db, args.conductorId, args.ano, args.mes, args.usuarioId, ahora);
  await recalcularResumenMes(db, {
    conductorId: args.conductorId, ano: args.ano, mes: args.mes,
    usuarioId: args.usuarioId, ahora, calendarioId: calendario.id,
  });

  const saldos = await saldosPendientesDeMes(db, args);
  await db.update(calendarios)
    .set({
      totalDcsPendientes: String(saldos.dcs),
      totalDndsPendientes: String(saldos.dnds),
      modifiedDate: ahora,
      modifiedBy: args.usuarioId,
    })
    .where(eq(calendarios.id, calendario.id));

  return saldos;
}

/**
 * Saldo de DCs y DNDs pendientes hasta el mes (REGLAS-CALCULO.md 15):
 * iniciales del conductor + regulaciones − colocados (resumenes de enero al
 * mes) y cobrados − reclamados en reclamaciones aún en curso. Unidades de
 * días, no euros. El resumen del mes debe estar recalculado.
 */
export async function saldosPendientesDeMes(
  db: Db,
  args: { conductorId: number; ano: number; mes: number },
): Promise<{ dcs: number; dnds: number }> {
  const primero = `${args.ano}-${String(args.mes).padStart(2, "0")}-01 00:00:00`;
  const limite = args.mes === 12 ? `${args.ano + 1}-01-01 00:00:00` : `${args.ano}-${String(args.mes + 1).padStart(2, "0")}-01 00:00:00`;
  const enero = `${args.ano}-01-01 00:00:00`;

  // Saldos iniciales del trabajador.
  const [doc] = await db.select({
    dcsIniciales: conductores.dcsIniciales,
    dndsIniciales: conductores.dndsIniciales,
  }).from(conductores).where(eq(conductores.id, args.conductorId));
  if (doc === undefined) throw new Error("Trabajador no encontrado.");

  // Regulaciones válidas: fecha anterior al primer día del mes siguiente.
  const regs = await db.select({
    dcs: regulaciones.dcs,
    dnds: regulaciones.dnds,
  }).from(regulaciones)
    .where(and(eq(regulaciones.conductorId, args.conductorId), lt(regulaciones.fecha, limite)));

  // Contadores de los resúmenes de enero al mes actual (acumulado del año).
  const filas = await db.select({
    diasDC: resumenes.diasDC,
    diasF6DC: resumenes.diasF6DC,
    diasDND: resumenes.diasDND,
    diasDF: resumenes.diasDF,
    diasComiteJD: resumenes.diasComiteJD,
    diasTrabajoJD: resumenes.diasTrabajoJD,
    diasTrabajoFN: resumenes.diasTrabajoFN,
    diasFORJD: resumenes.diasFORJD,
    diasFORFN: resumenes.diasFORFN,
    dndsCobrados: resumenes.totalDndsCobrados,
  }).from(resumenes)
    .innerJoin(calendarios, eq(resumenes.calendarioId, calendarios.id))
    .where(and(
      eq(calendarios.conductorId, args.conductorId),
      gte(calendarios.fecha, enero),
      lt(calendarios.fecha, limite),
    ));

  // DCs/DNDs reclamados en reclamaciones aún en curso del mes anterior y atrás.
  const reclamados = await db.select({
    tipo: conceptosReclamados.tipo,
    importeReal: conceptosReclamados.importeReal,
  }).from(conceptosReclamados)
    .innerJoin(reclamaciones, eq(conceptosReclamados.reclamacionId, reclamaciones.id))
    .where(and(
      eq(reclamaciones.conductorId, args.conductorId),
      eq(reclamaciones.cerrada, false),
      lt(reclamaciones.fecha, primero),
    ));
  const reclamadosDcs = reclamados
    .filter((r) => r.tipo === TipoReclamacion.TotalDc)
    .reduce((s, r) => s + aNumero(r.importeReal), 0);
  const reclamadosDnds = reclamados
    .filter((r) => r.tipo === TipoReclamacion.TotalDnd)
    .reduce((s, r) => s + aNumero(r.importeReal), 0);

  // Saldo hasta el mes (unidades de días, no euros).
  const acumulado = filas.reduce((s, f) => ({
    dc: s.dc + f.diasDC, f6dc: s.f6dc + f.diasF6DC,
    dnd: s.dnd + f.diasDND, df: s.df + f.diasDF,
    jd: s.jd + f.diasComiteJD + f.diasTrabajoJD + f.diasTrabajoFN + f.diasFORJD + f.diasFORFN,
    cobrados: s.cobrados + f.dndsCobrados,
  }), { dc: 0, f6dc: 0, dnd: 0, df: 0, jd: 0, cobrados: 0 });
  const redondea = (v: number) => Math.round(v * 10000) / 10000;
  const dcs = redondea(
    aNumero(doc.dcsIniciales) + regs.reduce((s, r) => s + aNumero(r.dcs), 0)
      - acumulado.dc - acumulado.f6dc - reclamadosDcs,
  );
  const dnds = redondea(
    aNumero(doc.dndsIniciales) + regs.reduce((s, r) => s + aNumero(r.dnds), 0)
      + acumulado.jd - acumulado.dnd - acumulado.df - acumulado.cobrados - reclamadosDnds,
  );

  return { dcs, dnds };
}

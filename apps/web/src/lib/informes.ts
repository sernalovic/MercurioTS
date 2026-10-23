/**
 * Consultas de la pantalla INFORMES (port de los endpoints de estadísticas
 * del original: `CalendariosController.PorFecha/AsignacionGraficos`,
 * `ResumenesController.Errores`, `GraficosController.Diferencias` y
 * `ReclamacionesController.ConceptosMes/ConceptosAño`). El cálculo que
 * depende del convenio (`TipoDiaGrafico`) usa `CalculosHorario` del dominio,
 * igual que el original en el servidor.
 */
import { and, asc, eq, gte, inArray, lte, max } from "drizzle-orm";
import {
  aMinutos, aNumero,
  calendarioDesdeFila, calendarios, conductores, conductorDesdeFila,
  convenioDesdeFilas, convenios, diasCalendario, festivos, graficoDesdeFila,
  graficos, opcionesCentro, regulaciones, reclamaciones, resumenDesdeFila,
  resumenes, tablasSalariales,
  conceptosReclamados as tablaConceptosReclamados,
  type Db,
} from "@mercurio/db";
import {
  CalculosHorario, diferencias, esDescanso, esTrabajo, tipoDiaPorFecha,
  CentroTrabajo, TipoDia,
  type Calendario as CalendarioDominio,
  type ConceptoReclamado, type Grafico as GraficoDominio,
} from "@mercurio/domain";

/** "2026-10" o "2026-10-01" → "2026-10-01 00:00:00" (convención de la BD). */
function fechaBD(fecha: string): string {
  return `${fecha.slice(0, 7)}-01 00:00:00`;
}

/** Convenio del año en formato dominio, o null si no existe. */
async function convenioDelAño(db: Db, año: number) {
  const [fila] = await db.select().from(convenios).where(eq(convenios.año, año)).limit(1);
  if (fila === undefined) return null;
  const [filasOp, filasFest, filasTab] = await Promise.all([
    db.select().from(opcionesCentro),
    db.select().from(festivos),
    db.select().from(tablasSalariales),
  ]);
  return convenioDesdeFilas(fila, filasOp, filasFest, filasTab);
}

/**
 * `GET calendarios/porFecha?fecha=AAAA-MM-01&centro=N` — calendarios del mes
 * con días, resumen (con sus Errores) y conductor. Lo usan el informe
 * «Errores en calendarios» y el Excel crudo de Herramientas.
 */
export async function cargarCalendariosDelMes(
  db: Db,
  fecha: string,
  centro: CentroTrabajo,
): Promise<CalendarioDominio[]> {
  const primero = fechaBD(fecha);
  const filasCal = await db.select().from(calendarios)
    .where(centro === CentroTrabajo.Todos
      ? eq(calendarios.fecha, primero)
      : and(eq(calendarios.fecha, primero), eq(calendarios.centro, centro)))
    .orderBy(asc(calendarios.conductorId));
  if (filasCal.length === 0) return [];
  const ids = filasCal.map((f) => f.id);
  const [filasDias, filasResumen, filasConductores] = await Promise.all([
    db.select().from(diasCalendario).where(inArray(diasCalendario.calendarioId, ids)).orderBy(asc(diasCalendario.fecha)),
    db.select().from(resumenes).where(inArray(resumenes.calendarioId, ids)),
    db.select().from(conductores),
  ]);
  const filasRegs = await db.select().from(regulaciones)
    .where(inArray(regulaciones.conductorId, filasConductores.length > 0 ? filasConductores.map((k) => k.id) : [-1]))
    .orderBy(asc(regulaciones.fecha));
  return filasCal.map((f) => {
    const resumen = filasResumen.find((r) => r.calendarioId === f.id);
    const conductorFila = filasConductores.find((k) => k.id === f.conductorId);
    const conductor = conductorFila === undefined ? null : conductorDesdeFila(
      conductorFila,
      filasRegs.filter((r) => r.conductorId === conductorFila.id),
    );
    return calendarioDesdeFila(
      f,
      filasDias.filter((d) => d.calendarioId === f.id),
      resumen === undefined ? null : resumenDesdeFila(resumen),
      conductor,
    );
  });
}

/** Port de `CalendariosController.AsignacionGraficos`. */
export interface AsignacionGraficos {
  fecha: string;
  esSabado: boolean;
  esFestivo: boolean;
  graficosParaDia: number;
  descansosParaDia: number;
  graficosAsignados: number;
  noAsignados: string;
  inexistentes: string;
}

/** Día de la semana UTC de una fecha "AAAA-MM-DD" (0 domingo … 6 sábado). */
function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00`).getUTCDay();
}

export async function asignacionGraficos(
  db: Db,
  fecha: string,
  centro: CentroTrabajo,
): Promise<AsignacionGraficos[]> {
  const primero = fechaBD(fecha);
  const convenio = await convenioDelAño(db, Number(fecha.slice(0, 4)));
  const calc = new CalculosHorario(convenio);
  const filasCal = await db.select({ id: calendarios.id })
    .from(calendarios)
    .where(and(eq(calendarios.fecha, primero), eq(calendarios.centro, centro)));
  if (filasCal.length === 0) return [];
  const dias = await db.select().from(diasCalendario)
    .where(inArray(diasCalendario.calendarioId, filasCal.map((f) => f.id)));
  const fechasGrupo = [...new Set(dias.map((d) => d.fecha.slice(0, 10)))].sort();

  const resultado: AsignacionGraficos[] = [];
  for (const f of fechasGrupo) {
    const grupoDia = dias.filter((d) => d.fecha.slice(0, 10) === f);
    const esFestivo = grupoDia.some((d) => d.esFestivo) || diaSemana(f) === 0;
    const tipo = esFestivo ? TipoDia.Festivo : tipoDiaPorFecha(f);
    // Grupo vigente en la fecha (el más reciente con validez ≤ f).
    const [maximo] = await db
      .select({ fecha: max(graficos.fecha) })
      .from(graficos)
      .where(and(eq(graficos.centro, centro), lte(graficos.fecha, fechaBD(f))));
    const fechaGrupo = maximo?.fecha ?? null;
    const numerosGrupo = fechaGrupo === null ? [] : (await db
      .select({ numero: graficos.numero })
      .from(graficos)
      .where(and(eq(graficos.centro, centro), eq(graficos.fecha, fechaGrupo))))
      .map((r) => r.numero);
    const delTipo = numerosGrupo.filter((n) => calc.tipoDiaGrafico(n, centro) === tipo);
    const delTipoSet = new Set(delTipo);
    const trabajados = grupoDia
      .filter((d) => esTrabajo(d.TrabajadoIncidencia, d.TrabajadoNumero))
      .map((d) => d.TrabajadoNumero)
      .filter((n) => n > 0);
    resultado.push({
      fecha: f,
      esSabado: diaSemana(f) === 6,
      esFestivo,
      graficosParaDia: delTipo.length,
      descansosParaDia: grupoDia.filter((d) => esDescanso(d.TrabajadoIncidencia)).length,
      graficosAsignados: trabajados.filter((n) => delTipoSet.has(n)).length,
      noAsignados: delTipo.filter((n) => !trabajados.includes(n)).sort((a, b) => a - b).join(", "),
      inexistentes: [...new Set(trabajados.filter((n) => !delTipoSet.has(n)))].sort((a, b) => a - b).join(", "),
    });
  }
  return resultado;
}

/** Graficos de un grupo de fecha+centro en formato dominio (sin itinerarios). */
export async function cargarGrupo(db: Db, fecha: string, centro: CentroTrabajo): Promise<GraficoDominio[]> {
  const filas = await db.select().from(graficos)
    .where(and(eq(graficos.centro, centro), eq(graficos.fecha, fechaBD(fecha))))
    .orderBy(asc(graficos.numero));
  return filas.map(graficoDesdeFila);
}

/** Port de `GraficosController.Diferencias` (usando `ComparacionGraficos`). */
export interface DiferenciaInforme { numeroGrafico: number; diferencias: string; }

export function diferenciasGrupos(
  g1: GraficoDominio[], g2: GraficoDominio[], fecha1: string, fecha2: string,
): DiferenciaInforme[] {
  return diferencias(g1, g2, fecha1, fecha2).map((d) => ({ numeroGrafico: d.numero, diferencias: d.diferencias }));
}

/** `existeGrupo` — true si hay algún gráfico con esa fecha de validez y centro. */
export async function existeGrupo(db: Db, fecha: string, centro: CentroTrabajo): Promise<boolean> {
  const filas = await db.select({ id: graficos.id })
    .from(graficos)
    .where(and(eq(graficos.centro, centro), eq(graficos.fecha, fechaBD(fecha))))
    .limit(1);
  return filas.length > 0;
}

/** Port de `ReclamacionesController.ConceptosMes/Año`: conceptos con matrícula. */
export interface ConceptoExtendido { matricula: number; concepto: ConceptoReclamado; }

export async function conceptosReclamados(
  db: Db,
  desde: string,
  hasta: string,
  centro: CentroTrabajo,
): Promise<ConceptoExtendido[]> {
  const filas = await db
    .select({ c: tablaConceptosReclamados, matricula: conductores.matricula })
    .from(tablaConceptosReclamados)
    .innerJoin(reclamaciones, eq(tablaConceptosReclamados.reclamacionId, reclamaciones.id))
    .innerJoin(conductores, eq(reclamaciones.conductorId, conductores.id))
    .where(and(
      gte(reclamaciones.fecha, fechaBD(desde)),
      lte(reclamaciones.fecha, fechaBD(hasta)),
      centro === CentroTrabajo.Todos ? undefined : eq(conductores.centro, centro),
    ))
    .orderBy(asc(conductores.matricula), asc(tablaConceptosReclamados.fecha), asc(tablaConceptosReclamados.id));
  return filas.map((f) => ({
    matricula: f.matricula,
    concepto: {
      id: f.c.id,
      reclamacionId: f.c.reclamacionId,
      fecha: f.c.fecha === "0001-01-01 00:00:00" ? "" : f.c.fecha.slice(0, 10),
      tipo: f.c.tipo,
      descripcion: f.c.descripcion,
      graficoTrabajado: f.c.graficoTrabajado,
      horasReales: aMinutos(f.c.horasReales),
      horasCobradas: aMinutos(f.c.horasCobradas),
      importeReal: aNumero(f.c.importeReal),
      importeCobrado: aNumero(f.c.importeCobrado),
      incidenciasReales: f.c.incidenciasReales,
      incidenciasCobradas: f.c.incidenciasCobradas,
      importeTotal: aNumero(f.c.importeTotal),
      resuelto: f.c.resuelto,
    },
  }));
}

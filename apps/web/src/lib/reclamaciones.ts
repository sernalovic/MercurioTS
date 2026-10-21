/**
 * Repositorio y formato de reclamaciones (port de "Reclamaciones" y
 * "Detalle reclamación" de Orión 2). La lectura es del portal; la generación
 * usa el motor de cálculo (`CalculosReclamacion` del dominio, REGLAS 14) y la
 * tramitación completa corresponde al escritorio.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  aMinutos, calendarioDesdeFila, calendarios, conceptosReclamados, conductorDesdeFila,
  conceptosAFilas, diasCalendario, reclamacionDesdeFilas, reclamaciones, resumenes, resumenDesdeFila,
  type ConceptosReclamados, type Reclamaciones, type Db,
} from "@mercurio/db";
import {
  esResuelta, generarReclamacion as generarReclamacionDominio,
  TipoReclamacion, TiposDieta, TiposPlus, type Reclamacion as ReclamacionDominio,
} from "@mercurio/domain";
import {
  asegurarCalendarioDelMes, conductorDominio, convenioDelAño,
  recalcularResumenMes, saldosPendientesDeMes,
} from "@/lib/calendario";

/** Reclamación con sus conceptos, tal como están en la BD. */
export interface ReclamacionConConceptos {
  fila: Reclamaciones;
  conceptos: ConceptosReclamados[];
}

/** Reclamaciones de un año (por mes) con sus conceptos, de enero a diciembre. */
export async function reclamacionesDelAño(
  db: Db,
  conductorId: number,
  ano: number,
): Promise<ReclamacionConConceptos[]> {
  const fils = await db
    .select()
    .from(reclamaciones)
    .where(and(
      eq(reclamaciones.conductorId, conductorId),
      gte(reclamaciones.fecha, `${ano}-01-01 00:00:00`),
      lte(reclamaciones.fecha, `${ano}-12-31 23:59:59`),
    ))
    .orderBy(asc(reclamaciones.fecha));
  if (fils.length === 0) return [];

  const conceptos = await db
    .select()
    .from(conceptosReclamados)
    .where(inArray(conceptosReclamados.reclamacionId, fils.map((f) => f.id)))
    .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));

  return fils.map((fila) => ({
    fila,
    conceptos: conceptos.filter((c) => c.reclamacionId === fila.id),
  }));
}

/** Una reclamación por id (solo del conductor dado); null si no existe. */
export async function reclamacionPorId(
  db: Db,
  conductorId: number,
  id: number,
): Promise<ReclamacionConConceptos | null> {
  const [fila] = await db
    .select()
    .from(reclamaciones)
    .where(and(eq(reclamaciones.id, id), eq(reclamaciones.conductorId, conductorId)))
    .limit(1);
  if (fila === undefined) return null;
  const conceptos = await db
    .select()
    .from(conceptosReclamados)
    .where(eq(conceptosReclamados.reclamacionId, fila.id))
    .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));
  return { fila, conceptos };
}

/** Fecha sentinel (DateTime.MinValue del original) = reclamación sin tramitar. */
export const FECHA_MINIMA = "0001-01-01 00:00:00";

/** Estado de la reclamación: "Sin tramitar", "En curso (fecha)" o "Cerrada". */
export function estadoDe(fila: Reclamaciones): string {
  if (fila.cerrada) return "Cerrada";
  if (fila.fechaEfecto === FECHA_MINIMA) return "Sin tramitar";
  const [fecha] = fila.fechaEfecto.split(" ");
  const [a, m, d] = fecha.split("-");
  return `En curso (${d}-${m}-${a})`;
}

/** Horas reclamadas totales de los conceptos, en minutos (interval → minutos). */
export function horasTotales(conceptos: ConceptosReclamados[]): number {
  return conceptos.reduce((acc, c) => acc + aMinutos(c.horasReales) - aMinutos(c.horasCobradas), 0);
}

/** Unidades de dietas reclamadas (importeReal − importeCobrado de los tipos de dieta). */
export function dietasTotales(conceptos: ConceptosReclamados[]): number {
  return conceptos
    .filter((c) => (TiposDieta as readonly number[]).includes(c.tipo))
    .reduce((acc, c) => acc + Number(c.importeReal) - Number(c.importeCobrado), 0);
}

/** Céntimos de las dietas reclamadas (importeTotal de los tipos de dieta). */
export function importeDietas(conceptos: ConceptosReclamados[]): number {
  return conceptos
    .filter((c) => (TiposDieta as readonly number[]).includes(c.tipo))
    .reduce((acc, c) => acc + Math.round(Number(c.importeTotal)), 0);
}

/** Céntimos del importe total reclamado (suma redondeada concepto a concepto). */
export function importeTotal(conceptos: ConceptosReclamados[]): number {
  return conceptos.reduce((acc, c) => acc + Math.round(Number(c.importeTotal)), 0);
}

/**
 * Tipos cuyo importeReal/importeCobrado son UNIDADES: dietas (2 decimales)
 * y DCs/DNDs pendientes (4 decimales). El resto con importes son euros.
 */
export function esUnidades(tipo: TipoReclamacion): boolean {
  return (TiposDieta as readonly number[]).includes(tipo) ||
    tipo === TipoReclamacion.TotalDc || tipo === TipoReclamacion.TotalDnd;
}

export interface ResultadoGeneracion {
  ok: boolean;
  mensaje: string;
}

/**
 * Genera (o regenera) la reclamación del mes del trabajador con el motor del
 * dominio (REGLAS-CALCULO.md 14): recálculo del resumen, concepto de cada
 * diferencia entre lo real (Trabajado) y lo cobrado (Virtual y Totales del
 * calendario), saldos de DCs/DNDs y notas con los totales.
 */
export async function generarReclamacionMensual(
  db: Db,
  args: { usuarioId: number; conductorId: number; ano: number; mes: number; ahora: string },
): Promise<ResultadoGeneracion> {
  const primero = `${args.ano}-${String(args.mes).padStart(2, "0")}-01 00:00:00`;

  // La reclamación del mes, si existe, y el motivo de no regenerarla.
  const [filaReclamacion] = await db
    .select()
    .from(reclamaciones)
    .where(and(eq(reclamaciones.conductorId, args.conductorId), eq(reclamaciones.fecha, primero)))
    .limit(1);
  let dominio: ReclamacionDominio;
  if (filaReclamacion === undefined) {
    dominio = {
      conductorId: args.conductorId,
      fecha: primero.slice(0, 10),
      fechaEfecto: args.ahora,
      codigo: null,
      notas: null,
      notaInterna: null,
      cerrada: false,
      conceptosReclamados: [],
    };
  } else {
    const conceptosFila = await db
      .select()
      .from(conceptosReclamados)
      .where(eq(conceptosReclamados.reclamacionId, filaReclamacion.id))
      .orderBy(asc(conceptosReclamados.fecha), asc(conceptosReclamados.id));
    dominio = reclamacionDesdeFilas(filaReclamacion, conceptosFila);
    if (dominio.cerrada) return { ok: false, mensaje: "La reclamación de ese mes está cerrada." };
    if (esResuelta(dominio)) {
      return { ok: false, mensaje: "La reclamación de ese mes ya está resuelta." };
    }
    // Los conceptos previos se quitan también del objeto del dominio (REGLAS 14.1);
    // el motor rellena la reclamación vacía.
    dominio.conceptosReclamados = [];
  }

  // Calendario del mes (lo crea si falta) y resumen recalculado al completo.
  const calendarioFila = await asegurarCalendarioDelMes(
    db, args.conductorId, args.ano, args.mes, args.usuarioId, args.ahora,
  );
  await recalcularResumenMes(db, {
    conductorId: args.conductorId, ano: args.ano, mes: args.mes,
    usuarioId: args.usuarioId, ahora: args.ahora, calendarioId: calendarioFila.id,
  });

  // Días + resumen + conductor del dominio y saldos de pendientes.
  const [filasDias, filaResumen] = await Promise.all([
    db.select().from(diasCalendario)
      .where(eq(diasCalendario.calendarioId, calendarioFila.id))
      .orderBy(asc(diasCalendario.fecha)),
    db.select().from(resumenes)
      .where(eq(resumenes.calendarioId, calendarioFila.id))
      .limit(1),
  ]);
  const cal = calendarioDesdeFila(
    calendarioFila,
    filasDias,
    filaResumen[0] === undefined ? null : resumenDesdeFila(filaResumen[0]),
    await conductorDominio(db, args.conductorId),
  );
  const convenio = await convenioDelAño(db, args.ano);
  const saldos = await saldosPendientesDeMes(db, { conductorId: args.conductorId, ano: args.ano, mes: args.mes });

  // Los conceptos previos se borran antes de regenerar (REGLAS 14.1); el
  // motor rellena la reclamación vacía.
  if (filaReclamacion !== undefined) {
    await db.delete(conceptosReclamados).where(eq(conceptosReclamados.reclamacionId, filaReclamacion.id));
  }
  if (!generarReclamacionDominio(dominio, cal, convenio?.importeDietas ?? 0, saldos.dcs, saldos.dnds, args.ahora)) {
    return { ok: false, mensaje: "La reclamación de ese mes no se puede regenerar." };
  }

  // Alta o modificación de la fila y reconstrucción de los conceptos.
  let idReclamacion: number;
  if (filaReclamacion === undefined) {
    const creada = await db.insert(reclamaciones).values({
      conductorId: args.conductorId,
      fecha: primero,
      fechaEfecto: dominio.fechaEfecto,
      codigo: dominio.codigo,
      notas: dominio.notas,
      notaInterna: dominio.notaInterna,
      cerrada: false,
      modifiedDate: args.ahora,
      modifiedBy: args.usuarioId,
    }).returning({ id: reclamaciones.id });
    idReclamacion = creada[0].id;
  } else {
    idReclamacion = filaReclamacion.id;
    await db.update(reclamaciones)
      .set({
        fechaEfecto: dominio.fechaEfecto,
        codigo: dominio.codigo,
        notas: dominio.notas,
        modifiedDate: args.ahora,
        modifiedBy: args.usuarioId,
      })
      .where(eq(reclamaciones.id, idReclamacion));
  }

  const conceptosFilaNuevos = conceptosAFilas(dominio);
  if (conceptosFilaNuevos.length > 0) {
    await db.insert(conceptosReclamados).values(
      conceptosFilaNuevos.map((f) => ({
        ...f,
        reclamacionId: idReclamacion,
        modifiedDate: args.ahora,
        modifiedBy: args.usuarioId,
      })),
    );
  }

  return { ok: true, mensaje: "Reclamación generada." };
}

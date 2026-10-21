/**
 * Repositorio y formato de reclamaciones (port de "Reclamaciones" y
 * "Detalle reclamación" de Orión 2). Solo lectura: la generación la hace el
 * motor de cálculo (CalculosReclamacion del dominio) y la tramitación el
 * escritorio.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  aMinutos, conceptosReclamados, reclamaciones, type ConceptosReclamados, type Reclamaciones,
} from "@mercurio/db";
import { TipoReclamacion, TiposDieta, TiposPlus } from "@mercurio/domain";
import type { Db } from "@mercurio/db";

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

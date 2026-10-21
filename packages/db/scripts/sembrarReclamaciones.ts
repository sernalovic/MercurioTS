/**
 * Sembrado de desarrollo: dos reclamaciones sintéticas que replican los
 * pantallazos de Orión 2 — la del mes dado (En curso, con DCs pendientes,
 * horas acumuladas, dietas y textos) y la del mes anterior (Sin tramitar).
 * NADA de esto son datos reales.
 *
 * NOTA: los enums requieren ejecutar node con --experimental-transform-types.
 *
 * Uso: node --experimental-transform-types scripts/sembrarReclamaciones.ts [matricula] [ano] [mes]
 * Requiere DATABASE_URL definida (ver README del paquete).
 */
import { and, eq, inArray } from "drizzle-orm";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { TipoReclamacion } from "../../domain/src/enums.ts";
import * as esquema from "../src/schema.ts";
import { aIntervalo } from "../src/convertir.ts";

const [matriculaArg, anoArg, mesArg] = process.argv.slice(2);
const matricula = Number(matriculaArg) || 450;
const hoy = new Date();
const ano = Number(anoArg) || hoy.getFullYear();
const mes = Number(mesArg) || hoy.getMonth() + 1;
const mesAnterior = mes === 1 ? 12 : mes - 1;
const anoAnterior = mes === 1 ? ano - 1 : ano;

/** Sentinel del original (DateTime.MinValue): reclamación Sin tramitar. */
const FECHA_MINIMA = "0001-01-01 00:00:00";

const ultimoDia = (m: number, a: number): number => new Date(Date.UTC(a, m, 0)).getUTCDate();
/** Fecha "YYYY-MM-DD HH:mm:ss" del dominio/BD. */
const d = (dia: number, m: number, a: number): string =>
  `${a}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")} 00:00:00`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: esquema });
try {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  const [conductor] = await db.select().from(esquema.conductores)
    .where(eq(esquema.conductores.matricula, matricula)).limit(1);
  if (conductor === undefined) throw new Error(`No existe el conductor de matrícula ${matricula}.`);

  // Regenera desde cero las reclamaciones de los dos meses (cascada a conceptos).
  const previas = await db.select({ id: esquema.reclamaciones.id }).from(esquema.reclamaciones)
    .where(and(
      eq(esquema.reclamaciones.conductorId, conductor.id),
      inArray(esquema.reclamaciones.fecha, [
        d(1, mes, ano), d(1, mesAnterior, anoAnterior),
      ]),
    ));
  for (const f of previas) {
    await db.delete(esquema.reclamaciones).where(eq(esquema.reclamaciones.id, f.id));
  }

  const concepto = (
    tipo: TipoReclamacion, fecha: string, descripcion: string,
    extras: { grafico?: number; horas?: [number, number]; importes?: [string, string]; total?: string },
  ): Omit<typeof esquema.conceptosReclamados.$inferInsert, "reclamacionId"> => ({
    fecha,
    tipo,
    descripcion,
    graficoTrabajado: extras.grafico ?? 0,
    horasReales: extras.horas === undefined ? "00:00:00" : aIntervalo(extras.horas[0]),
    horasCobradas: extras.horas === undefined ? "00:00:00" : aIntervalo(extras.horas[1]),
    importeReal: extras.importes === undefined ? "0" : extras.importes[0],
    importeCobrado: extras.importes === undefined ? "0" : extras.importes[1],
    incidenciasReales: 0,
    incidenciasCobradas: 0,
    importeTotal: extras.total ?? "0",
    resuelto: false,
    modifiedDate: ahora,
    modifiedBy: 1,
  });

  const crear = async (
    m: number, a: number, fechaEfecto: string,
    conceptos: Array<Omit<typeof esquema.conceptosReclamados.$inferInsert, "reclamacionId">>,
  ): Promise<void> => {
    const codigo = `${a}${String(m).padStart(2, "0")}${matricula}`;
    const [fila] = await db.insert(esquema.reclamaciones).values({
      conductorId: conductor.id,
      fecha: d(1, m, a),
      fechaEfecto,
      codigo,
      notas: null,
      notaInterna: null,
      cerrada: false,
      modifiedDate: ahora,
      modifiedBy: 1,
    }).returning();
    for (const c of conceptos) {
      await db.insert(esquema.conceptosReclamados).values({ ...c, reclamacionId: fila.id });
    }
    console.log(`Reclamación ${codigo} (${m}/${a}): ${conceptos.length} conceptos.`);
  };

  // Mes dado: "En curso" con el surtido del pantallazo.
  await crear(mes, ano, ahora, [
    concepto(TipoReclamacion.TotalDc, FECHA_MINIMA, "DCs pendientes",
      { importes: ["14.59", "0"] }),
    concepto(TipoReclamacion.HorasAcumuladas, d(2, mes, ano), "Horas acumuladas del día 2",
      { grafico: 3503, horas: [80, 70] }),
    concepto(TipoReclamacion.OtraHoras, d(12, mes, ano), "Renovacion del carnet", {}),
    concepto(TipoReclamacion.Descanso, d(15, mes, ano), "La situación no es E, sino que es JD", {}),
    concepto(TipoReclamacion.HorasAcumuladas, d(ultimoDia(mes, ano), mes, ano),
      `Horas acumuladas del día ${ultimoDia(mes, ano)}`,
      { grafico: 3004, horas: [10, 0] }),
    concepto(TipoReclamacion.DietaCena, d(ultimoDia(mes, ano), mes, ano),
      `Dieta de cena del día ${ultimoDia(mes, ano)}`,
      { grafico: 3004, importes: ["0.25", "0"], total: "384" }),
  ]);

  // Mes anterior: "Sin tramitar" con quebranto y horas.
  await crear(mesAnterior, anoAnterior, FECHA_MINIMA, [
    concepto(TipoReclamacion.QuebrantoMoneda, FECHA_MINIMA, "Importe quebranto de moneda",
      { importes: ["2304", "0"], total: "2304" }),
    concepto(TipoReclamacion.HorasAcumuladas, d(9, mesAnterior, anoAnterior), "Horas acumuladas del día 9",
      { grafico: 3603, horas: [30, 0] }),
  ]);
} finally {
  await pool.end();
}

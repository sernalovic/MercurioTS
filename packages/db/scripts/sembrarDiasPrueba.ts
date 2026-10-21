/**
 * Sembrado de desarrollo: días del mes en curso para el trabajador de
 * prueba. Patrón sintético creíble: lunes a viernes de trabajo (gráficos de
 * mañana/tarde con horas), sábado y domingo de descanso (JD), un DC, un F6 y
 * un día con comité (horas sindicales) y notas. NADA de esto son datos reales.
 *
 * NOTA: los enums requieren ejecutar node con --experimental-transform-types
 * (los enum de TypeScript no se pueden transformar en modo strip-only).
 *
 * Uso: node --experimental-transform-types scripts/sembrarDiasPrueba.ts [matricula] [ano] [mes]
 * Requiere DATABASE_URL definida (ver README del paquete).
 */
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { CodigoIncidencia, Incidencia, Turno } from "../../domain/src/enums.ts";
import * as esquema from "../src/schema.ts";
import { aIntervalo, aMinutos } from "../src/convertir.ts";

const [matriculaArg, anoArg, mesArg] = process.argv.slice(2);
const matricula = Number(matriculaArg) || 450;
const hoy = new Date();
const ano = Number(anoArg) || hoy.getFullYear();
const mes = Number(mesArg) || hoy.getMonth() + 1;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: esquema });
try {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");

  const [conductor] = await db.select().from(esquema.conductores).where(eq(esquema.conductores.matricula, matricula)).limit(1);
  if (conductor === undefined) throw new Error(`No existe el conductor de matrícula ${matricula} (usa scripts/crearTrabajadorDePrueba.ts).`);

  const primero = `${ano}-${String(mes).padStart(2, "0")}-01 00:00:00`;
  const [calendario] = await db.select().from(esquema.calendarios)
    .where(and(eq(esquema.calendarios.conductorId, conductor.id), eq(esquema.calendarios.fecha, primero))).limit(1);
  const calendarioId = calendario === undefined
    ? (await db.insert(esquema.calendarios).values({
        conductorId: conductor.id, centro: 1, fecha: primero,
        totalImportePlusSabados: "0", totalImportePlusFestivos: "0", totalImportePlusNocturnidad: "0",
        totalImportePlusNocturnidadParcial: "0", totalImportePlusPaqueteria: "0", totalImportePlusLimpieza: "0",
        totalImportePlusMenorDescanso: "0", totalImportePlusNavidad: "0", totalImportePlusViaje: "0",
        totalQuebrantoMoneda: "0", totalRefuerzos: "0", totalImporteDietas: "0",
        totalDcsPendientes: "0", totalDndsPendientes: "0", totalImporteDndsCobrados: "0",
        modifiedDate: ahora, modifiedBy: 1,
      }).returning())[0].id
    : calendario.id;

  // Regenera los días del mes desde cero (cascada de DiasCalendario vía FK).
  const previos = await db.select().from(esquema.diasCalendario).where(eq(esquema.diasCalendario.calendarioId, calendarioId));
  for (const f of previos) await db.delete(esquema.diasCalendario).where(eq(esquema.diasCalendario.id, f.id));

  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const filasDia: Array<typeof esquema.diasCalendario.$inferInsert> = [];
  const conteo = new Map<number, number>();
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const fecha = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")} 00:00:00`;
    const semana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay(); // 0=domingo

    let incidencia = Incidencia.Trabajo;
    let turno = Turno.Manana;
    let numero = 3503;
    let inicio: number | null = 7 * 60 + 15; // 07:15
    let final: number | null = 15 * 60 + 15; // 15:15
    let codigo = CodigoIncidencia.Ninguno;
    let vehiculos: string | null = "404";
    let notas: string | null = null;
    // Datos propios del pijama (horas acumuladas y dietas).
    let acumuladas: number | null = null; // minutos
    let cena = 0;
    const acumuladasDeDia: Record<number, number> = { 2: 40, 3: 30, 13: 55, 14: 55, 15: 70, 29: 15 };
    if (dia in acumuladasDeDia) acumuladas = acumuladasDeDia[dia];
    if (dia === 3) cena = 0.58;

    if (semana === 6 || semana === 0) {
      incidencia = Incidencia.JD;
      turno = Turno.SinTurno;
      numero = 0;
      inicio = null;
      final = null;
      vehiculos = null;
    } else if (dia === 9) {
      // Un DC suelto a mitad de mes
      incidencia = Incidencia.DC;
      turno = Turno.SinTurno;
      numero = 0;
      inicio = null;
      final = null;
      vehiculos = null;
    } else if (dia === 22) {
      // Un F6 (día de libre disposición)
      incidencia = Incidencia.F6;
      turno = Turno.SinTurno;
      numero = 0;
      inicio = null;
      final = null;
      vehiculos = null;
    } else if (dia === 14) {
      // Grafico de tarde
      turno = Turno.Tarde;
      numero = 3603;
      inicio = 14 * 60 + 45; // 14:45
      final = 22 * 60 + 35; // 22:35
      vehiculos = "424 404";
    } else if (dia === 21) {
      // Comité (horas sindicales) con notas
      codigo = CodigoIncidencia.HorasSindicales;
      notas = "Comité por la tarde: llevar carné nuevo";
      numero = 3503;
      vehiculos = "404";
    }

    filasDia.push({
      calendarioId, fecha,
      esFestivo: false,
      TrabajadoIncidencia: incidencia,
      TrabajadoCodigo: codigo,
      TrabajadoCategoria: 0,
      TrabajadoNumero: numero,
      TrabajadoTipoDia: 0,
      TrabajadoTurno: turno,
      TrabajadoInicio: inicio === null ? null : aIntervalo(inicio),
      TrabajadoFinal: final === null ? null : aIntervalo(final),
      TrabajadoInicioPartido: null,
      TrabajadoFinalPartido: null,
      TrabajadoValoracion: inicio === null || final === null ? "00:00:00" : aIntervalo(final - inicio),
      TrabajadoTiempoTotal: inicio === null || final === null ? "00:00:00" : aIntervalo(final - inicio),
      TrabajadoTiempoPartido: "00:00:00",
      TrabajadoTrabajadas: inicio === null || final === null ? "00:00:00" : aIntervalo(final - inicio),
      TrabajadoTrabajadasConvenio: inicio === null || final === null ? "00:00:00" : aIntervalo(final - inicio),
      TrabajadoTiempoVacio: "00:00:00",
      TrabajadoAcumuladas: acumuladas === null ? "00:00:00" : aIntervalo(acumuladas),
      TrabajadoNocturnas: "00:00:00",
      TrabajadoPlusPaqueteria: "0",
      TrabajadoFacturadoPaqueteria: "0",
      TrabajadoLimpieza: "0",
      TrabajadoPlusMenorDescanso: "0",
      TrabajadoNoCalcular: false,
      TrabajadoDesayuno: "0",
      TrabajadoComida: "0",
      TrabajadoCena: String(cena),
      TrabajadoTienePlusPaqueteria: incidencia === Incidencia.Trabajo,
      notas,
      vehiculos,
      refuerzos: 0,
      dndCobrado: false,
      dndsCobradosPorDescanso: "0",
      isRemoteUpdated: false,
      modifiedDate: ahora,
      modifiedBy: 1,
      ...esquemaCamposEnBlanco("Anual"),
      ...esquemaCamposEnBlanco("Virtual"),
    });
    conteo.set(incidencia, (conteo.get(incidencia) ?? 0) + 1);
  }
  await db.insert(esquema.diasCalendario).values(filasDia);

  // Recuentos del resumen (mismos pares que la web al guardar).
  const FIELD_DE: Array<[keyof typeof esquema.resumenes.$inferInsert, number]> = [
    ["diasTrabajo", Incidencia.Trabajo], ["diasTrabajoJD", Incidencia.TrabajoJD],
    ["diasTrabajoFN", Incidencia.TrabajoFN], ["diasJD", Incidencia.JD], ["diasFN", Incidencia.FN],
    ["diasDS", Incidencia.DS], ["diasDC", Incidencia.DC], ["diasDND", Incidencia.DND],
    ["diasF6", Incidencia.F6], ["diasF6D", Incidencia.F6D], ["diasF6DC", Incidencia.F6DC],
    ["diasPER", Incidencia.PER], ["diasDF", Incidencia.DF], ["diasOV", Incidencia.OV],
    ["diasOVJD", Incidencia.OVJD], ["diasOVFN", Incidencia.OVFN], ["diasE", Incidencia.E],
    ["diasEJD", Incidencia.EJD], ["diasEFN", Incidencia.EFN], ["diasFOR", Incidencia.FOR],
    ["diasFORJD", Incidencia.FORJD], ["diasFORFN", Incidencia.FORFN],
  ];
  const parche: Record<string, number> = {};
  for (const [campo, incidencia] of FIELD_DE) {
    parche[campo as string] = conteo.get(incidencia) ?? 0;
  }
  await db.update(esquema.resumenes)
    .set(parche as Partial<typeof esquema.resumenes.$inferInsert>)
    .where(eq(esquema.resumenes.calendarioId, calendarioId));

  // Pendientes e importes de demostración, como en los pantallazos de Orión 2.
  await db.update(esquema.calendarios)
    .set({
      totalDcsPendientes: "20.86", totalDndsPendientes: "3",
      totalImportePlusSabados: "23.18", totalImportePlusFestivos: "46.35",
      totalImportePlusNocturnidad: "0", totalImportePlusNocturnidadParcial: "0.63",
      totalImportePlusPaqueteria: "31.48", totalImportePlusLimpieza: "185.64",
      totalImportePlusMenorDescanso: "0", totalImportePlusNavidad: "0",
      totalImportePlusViaje: "0", totalQuebrantoMoneda: "23.04",
      totalImporteDietas: "9.60", totalRefuerzos: "0", totalImporteDndsCobrados: "0",
      modifiedDate: ahora,
    })
    .where(eq(esquema.calendarios.id, calendarioId));

  const trabajadasTotal = filasDia
    .filter((f) => f.TrabajadoIncidencia === Incidencia.Trabajo && f.TrabajadoTrabajadas !== "00:00:00")
    .reduce((suma, f) => suma + aMinutos(f.TrabajadoTrabajadas as string), 0);
  const resumen = FIELD_DE
    .filter(([, incidencia]) => (conteo.get(incidencia) ?? 0) > 0)
    .map(([campo, incidencia]) => `${String(campo).slice(4)}: ${conteo.get(incidencia)}`)
    .join(", ");
  console.log(`Días sembrados para ${ano}-${String(mes).padStart(2, "0")}: ${filasDia.length} filas.`);
  console.log(`Recuento → ${resumen}`);
  console.log(`Horas trabajadas del mes (tramos): ${Math.floor(trabajadasTotal / 60)} h ${trabajadasTotal % 60} min`);
} finally {
  await pool.end();
}

/** Columnas de un servicio (Anual/Virtual) en blanco, port de la web. */
function esquemaCamposEnBlanco(
  prefijo: "Anual" | "Virtual",
): Record<string, string | number | boolean | null> {
  return {
    [`${prefijo}Incidencia`]: Incidencia.Inactivo,
    [`${prefijo}Codigo`]: CodigoIncidencia.Ninguno,
    [`${prefijo}Categoria`]: 0,
    [`${prefijo}Numero`]: 0,
    [`${prefijo}TipoDia`]: 0,
    [`${prefijo}Turno`]: 0,
    [`${prefijo}PlusPaqueteria`]: "0",
    [`${prefijo}FacturadoPaqueteria`]: "0",
    [`${prefijo}Limpieza`]: "0",
    [`${prefijo}PlusMenorDescanso`]: "0",
    [`${prefijo}NoCalcular`]: false,
    [`${prefijo}Inicio`]: null,
    [`${prefijo}Final`]: null,
    [`${prefijo}InicioPartido`]: null,
    [`${prefijo}FinalPartido`]: null,
    [`${prefijo}Valoracion`]: "00:00:00",
    [`${prefijo}TiempoTotal`]: "00:00:00",
    [`${prefijo}TiempoPartido`]: "00:00:00",
    [`${prefijo}Trabajadas`]: "00:00:00",
    [`${prefijo}TrabajadasConvenio`]: "00:00:00",
    [`${prefijo}TiempoVacio`]: "00:00:00",
    [`${prefijo}Acumuladas`]: "00:00:00",
    [`${prefijo}Nocturnas`]: "00:00:00",
    [`${prefijo}Desayuno`]: "0",
    [`${prefijo}Comida`]: "0",
    [`${prefijo}Cena`]: "0",
    [`${prefijo}TienePlusPaqueteria`]: false,
  };
}

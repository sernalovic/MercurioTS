/**
 * Detalle de calendario del escritorio (port del ViewModel `DetalleCalendario`):
 * carga un calendario completo como objetos de dominio (para recálculo en el
 * cliente con `CalculosHorario`/`CalculosCalendario`/Saldos) y lo vuelve a
 * guardar con los tres servicios de cada día y el resumen.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  aNumero, calendarioDesdeFila, calendarios, conceptosReclamados,
  conductorDesdeFila, conductores, diaDesdeFila, diasCalendario, graficoDesdeFila, graficos,
  reclamaciones, regulaciones, resumenAFila, resumenDesdeFila, resumenes,
  servicioAnualAColumnas, servicioTrabajadoAColumnas, servicioVirtualAColumnas,
  type Db,
} from "@mercurio/db";
import {
  TipoReclamacion, type Calendario, type DiaCalendario, type Grafico, type ResumenCalendario,
} from "@mercurio/domain";

/** Primer día del mes de la fecha ("AAAA-MM-DD"). */
export function mesDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/** Calendario completo en formato de dominio, o null si no existe. */
export async function cargarCalendarioCompleto(db: Db, id: number): Promise<Calendario | null> {
  const [fila] = await db.select().from(calendarios).where(eq(calendarios.id, id)).limit(1);
  if (fila === undefined) return null;
  const [filaConductor] = await db.select().from(conductores).where(eq(conductores.id, fila.conductorId)).limit(1);
  if (filaConductor === undefined) return null;
  const filasRegulaciones = await db
    .select().from(regulaciones).where(eq(regulaciones.conductorId, filaConductor.id))
    .orderBy(asc(regulaciones.fecha));
  const filasDias = await db
    .select().from(diasCalendario).where(eq(diasCalendario.calendarioId, id))
    .orderBy(asc(diasCalendario.fecha));
  const [filaResumen] = await db.select().from(resumenes).where(eq(resumenes.calendarioId, id)).limit(1);
  return calendarioDesdeFila(
    fila,
    filasDias,
    filaResumen === undefined ? null : resumenDesdeFila(filaResumen),
    conductorDesdeFila(filaConductor, filasRegulaciones),
  );
}

interface EntradaDia {
  id?: number;
  fecha: string;
  esFestivo?: boolean;
  notas?: string | null;
  vehiculos?: string | null;
  refuerzos?: number;
  dndCobrado?: boolean;
  dndsCobradosPorDescanso?: number;
  isRemoteUpdated?: boolean;
  servicioAnual: unknown;
  servicioTrabajado: unknown;
  servicioVirtual: unknown;
}

/** Columnas de un día a partir del dominio entrante (servicios + datos del día, con auditoría). */
function columnasDia(
  d: EntradaDia,
  sesionId: number,
  ahora: string,
): Omit<typeof diasCalendario.$inferInsert, "id" | "calendarioId" | "fecha"> {
  return {
    ...servicioTrabajadoAColumnas(d.servicioTrabajado as never),
    ...servicioVirtualAColumnas(d.servicioVirtual as never),
    ...servicioAnualAColumnas(d.servicioAnual as never),
    esFestivo: d.esFestivo === true,
    notas: d.notas ?? null,
    vehiculos: d.vehiculos ?? null,
    refuerzos: Math.round(Number(d.refuerzos ?? 0)),
    dndCobrado: d.dndCobrado === true,
    // Céntimos del dominio → texto numérico de BD (0.00 = fila anotada sin importe).
    dndsCobradosPorDescanso: (Math.round((Number(d.dndsCobradosPorDescanso ?? 0)) * 100) / 100).toFixed(2),
    isRemoteUpdated: d.isRemoteUpdated === true,
    modifiedDate: ahora,
    modifiedBy: sesionId,
  };
}

const TOTALES_CENTIMOS = [
  "totalImportePlusSabados", "totalImportePlusFestivos", "totalImportePlusNocturnidad",
  "totalImportePlusNocturnidadParcial", "totalImportePlusPaqueteria", "totalImportePlusLimpieza",
  "totalImportePlusMenorDescanso", "totalImportePlusNavidad", "totalImportePlusViaje",
  "totalQuebrantoMoneda", "totalRefuerzos", "totalImporteDietas", "totalImporteDndsCobrados",
] as const;
const TOTALES_UNIDADES = ["totalDcsPendientes", "totalDndsPendientes"] as const;

/** Guardar calendario completo: días (existentes o nuevos), resumen y totales del calendario. */
export async function guardarCalendarioCompleto(
  db: Db,
  id: number,
  payload: { dias?: EntradaDia[]; resumen?: ResumenCalendario | null } & Record<string, unknown>,
  sesionId: number,
  ahora: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const valores: Record<string, string | number> = { modifiedDate: ahora, modifiedBy: sesionId };
    for (const c of TOTALES_CENTIMOS) valores[c] = centimoATexto(payload[c]);
    for (const c of TOTALES_UNIDADES) valores[c] = aTextoNumericoLocal(payload[c]);
    await tx.update(calendarios).set(valores as never).where(eq(calendarios.id, id));

    for (const d of payload.dias ?? []) {
      const fecha = String(d.fecha ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
      const valoresDia = columnasDia(d, sesionId, ahora);
      const idDia = Number(d.id ?? 0);
      if (Number.isInteger(idDia) && idDia > 0) {
        await tx.update(diasCalendario).set(valoresDia).where(eq(diasCalendario.id, idDia));
      } else {
        await tx.insert(diasCalendario).values({ ...valoresDia, calendarioId: id, fecha: `${fecha} 00:00:00` });
      }
    }

    if (payload.resumen) {
      await tx.update(resumenes)
        .set({ ...resumenAFila(payload.resumen), modifiedDate: ahora, modifiedBy: sesionId })
        .where(eq(resumenes.calendarioId, id));
    }
  });
}

/** Euros a texto de céntimos (dominio viaja en céntimos; BD quiere "0.00"). */
function centimoATexto(v: unknown): string {
  const n = Math.round(Number(v ?? 0));
  return (n / 100).toFixed(2);
}

/** Unidades a texto decimal con 2 décimas (dietas, DCs, DNDs). */
function aTextoNumericoLocal(v: unknown): string {
  const n = Math.round(Number(v ?? 0) * 100) / 100;
  return n.toFixed(2);
}

/** Día concreto de un conductor (los vecinos del líder de descanso y del resumen). */
export async function cargarDia(db: Db, fecha: string, idConductor: number): Promise<DiaCalendario | null> {
  const primero = mesDe(fecha);
  const [calendario] = await db.select().from(calendarios)
    .where(and(eq(calendarios.conductorId, idConductor), eq(calendarios.fecha, `${primero} 00:00:00`)))
    .limit(1);
  if (calendario === undefined) return null;
  const [fila] = await db.select().from(diasCalendario)
    .where(and(eq(diasCalendario.calendarioId, calendario.id), eq(diasCalendario.fecha, `${fecha} 00:00:00`)))
    .limit(1);
  return fila === undefined ? null : diaDesdeFila(fila);
}

/** Gráfico válido en el mes de una fecha (por número, centro y mes). */
export async function cargarGraficoDeFecha(db: Db, numero: number, fecha: string, centro: number): Promise<Grafico | null> {
  const [fila] = await db.select().from(graficos)
    .where(and(
      eq(graficos.numero, numero),
      eq(graficos.centro, centro),
      eq(graficos.fecha, `${mesDe(fecha)} 00:00:00`),
    ))
    .limit(1);
  return fila === undefined ? null : graficoDesdeFila(fila);
}

/**
 * Acumulado de los resúmenes de un conductor (por matrícula) entre dos meses,
 * como `Acumular(resumenes)` del original: se suman todos los campos numéricos.
 */
export async function acumuladoResumenes(
  db: Db,
  matricula: number,
  desdeMes: string,
  hastaMes: string,
): Promise<ResumenCalendario | null> {
  const filas = await db
    .select({ resumen: resumenes })
    .from(calendarios)
    .innerJoin(conductores, eq(calendarios.conductorId, conductores.id))
    .innerJoin(resumenes, eq(resumenes.calendarioId, calendarios.id))
    .where(and(
      eq(conductores.matricula, matricula),
      gte(calendarios.fecha, `${desdeMes} 00:00:00`),
      lte(calendarios.fecha, `${hastaMes} 00:00:00`),
    ));
  if (filas.length === 0) return null;
  const dominios = filas.map((f) => resumenDesdeFila(f.resumen) as unknown as Record<string, unknown>);
  const total: Record<string, unknown> = {};
  for (const r of dominios) {
    for (const clave of Object.keys(r)) {
      const valor = r[clave];
      if (typeof valor === "number") {
        total[clave] = ((total[clave] as number | undefined) ?? 0) + valor;
      } else if (typeof valor === "string" && valor !== "" && total[clave] === undefined) {
        total[clave] = valor;
      }
    }
  }
  return total as unknown as ResumenCalendario;
}

/** Importes reclamados en reclamaciones en curso (ni cerradas ni con todos los conceptos resueltos). */
export async function reclamadosEnCurso(
  db: Db,
  tipo: TipoReclamacion,
  fechaMes: string,
  idConductor: number,
): Promise<number> {
  const mes = mesDe(fechaMes);
  const enCurso = await db
    .select({ id: reclamaciones.id, fecha: reclamaciones.fecha })
    .from(reclamaciones)
    .where(and(
      eq(reclamaciones.conductorId, idConductor),
      eq(reclamaciones.cerrada, false),
    ));
  const ids = enCurso
    .filter((r) => r.fecha.slice(0, 10) < mes)
    .map((r) => r.id);
  if (ids.length === 0) return 0;
  const conceptos = await db
    .select({
      reclamacionId: conceptosReclamados.reclamacionId,
      tipo: conceptosReclamados.tipo,
      resuelto: conceptosReclamados.resuelto,
      importeReal: conceptosReclamados.importeReal,
      importeCobrado: conceptosReclamados.importeCobrado,
    })
    .from(conceptosReclamados)
    .where(inArray(conceptosReclamados.reclamacionId, ids));
  const conPendientes = new Set(
    conceptos.filter((c) => !c.resuelto).map((c) => c.reclamacionId),
  );
  return conceptos
    .filter((c) => c.tipo === tipo && conPendientes.has(c.reclamacionId))
    .reduce((acc, c) => acc + (aNumero(c.importeReal) - aNumero(c.importeCobrado)), 0);
}

/**
 * Operaciones masivas del mes sobre los calendarios — port del
 * `ServicioCalendarios` del API original: marcar festivos, ajustar JDs,
 * recalcular resúmenes y regenerar todos los servicios con los gráficos
 * vigentes (REGLAS-CALCULO.md 6–8 y 12).
 */
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import {
  calendarioDesdeFila, calendarios, conductorDesdeFila, conductores,
  diaDesdeFila, diasCalendario, graficos, graficoDesdeFila, regulaciones,
  resumenAFila, resumenDesdeFila, resumenes,
  servicioTrabajadoAColumnas, servicioVirtualAColumnas,
  type Db, type DiasCalendario,
} from "@mercurio/db";
import {
  CalculosHorario, ajustarJDs, esTrabajo, recalcularResumen as recalcularResumenDominio,
  type Calendario, type DiaCalendario, type Grafico,
} from "@mercurio/domain";
import { convenioDelAño } from "./calendario";

export interface ContextoMes {
  db: Db;
  ano: number;
  mes: number;
  centro: number; // 0 = Todos
  usuarioId: number;
  ahora: string;
}

/** Primer y último día del mes en formato de fila de BD. */
function rangoMes(ano: number, mes: number): { primero: string; ultimo: string } {
  const a = String(ano);
  const m = String(mes).padStart(2, "0");
  const dias = String(new Date(ano, mes, 0).getDate()).padStart(2, "0");
  return { primero: `${a}-${m}-01 00:00:00`, ultimo: `${a}-${m}-${dias} 00:00:00` };
}

/** Calendarios del mes (con su centro o de todos), con días, resumen y conductor dominio. */
async function cargarMes(ctx: ContextoMes): Promise<Calendario[]> {
  const { primero } = rangoMes(ctx.ano, ctx.mes);
  const filasCal = await ctx.db
    .select()
    .from(calendarios)
    .where(
      ctx.centro === 0
        ? eq(calendarios.fecha, primero)
        : and(eq(calendarios.fecha, primero), eq(calendarios.centro, ctx.centro)),
    );
  if (filasCal.length === 0) return [];

  const idsConductores = [...new Set(filasCal.map((c) => c.conductorId))];
  const [filasConductores, filasRegs] = await Promise.all([
    ctx.db.select().from(conductores).where(inArray(conductores.id, idsConductores)),
    ctx.db.select().from(regulaciones).where(inArray(regulaciones.conductorId, idsConductores)),
  ]);
  const conductoresPorId = new Map(
    filasConductores.map((f) => [
      f.id,
      conductorDesdeFila(f, filasRegs.filter((r) => r.conductorId === f.id)),
    ]),
  );

  const idsCal = filasCal.map((c) => c.id);
  const [filasDias, filasResumen] = await Promise.all([
    ctx.db.select().from(diasCalendario).where(inArray(diasCalendario.calendarioId, idsCal)).orderBy(asc(diasCalendario.fecha)),
    ctx.db.select().from(resumenes).where(inArray(resumenes.calendarioId, idsCal)),
  ]);
  const diasPorCalendario = new Map<number, DiasCalendario[]>();
  for (const d of filasDias) {
    const lista = diasPorCalendario.get(d.calendarioId) ?? [];
    lista.push(d);
    diasPorCalendario.set(d.calendarioId, lista);
  }
  const resumenPorCalendario = new Map(filasResumen.map((r) => [r.calendarioId, resumenDesdeFila(r)]));

  return filasCal.map((f) =>
    calendarioDesdeFila(
      f,
      diasPorCalendario.get(f.id) ?? [],
      resumenPorCalendario.get(f.id) ?? null,
      conductoresPorId.get(f.conductorId) ?? null,
    ),
  );
}

/**
 * Último día del mes anterior y primero del siguiente de cada conductor
 * (frontera del cálculo de acumuladas y pluses), en una sola consulta.
 */
async function vecinosDelMes(
  ctx: ContextoMes,
): Promise<Map<number, { anterior: DiaCalendario | null; siguiente: DiaCalendario | null }>> {
  const añoAnterior = ctx.mes === 1 ? ctx.ano - 1 : ctx.ano;
  const mesAnterior = String(ctx.mes === 1 ? 12 : ctx.mes - 1).padStart(2, "0");
  const diasAnterior = String(new Date(ctx.ano, ctx.mes - 1, 0).getDate()).padStart(2, "0");
  const añoSiguiente = ctx.mes === 12 ? ctx.ano + 1 : ctx.ano;
  const mesSiguiente = String(ctx.mes === 12 ? 1 : ctx.mes + 1).padStart(2, "0");
  const fechaAnterior = `${añoAnterior}-${mesAnterior}-${diasAnterior} 00:00:00`;
  const fechaSiguiente = `${añoSiguiente}-${mesSiguiente}-01 00:00:00`;

  const filas = await ctx.db
    .select({ conductorId: calendarios.conductorId, fila: diasCalendario })
    .from(diasCalendario)
    .innerJoin(calendarios, eq(diasCalendario.calendarioId, calendarios.id))
    .where(inArray(diasCalendario.fecha, [fechaAnterior, fechaSiguiente]));

  const vecinos = new Map<number, { anterior: DiaCalendario | null; siguiente: DiaCalendario | null }>();
  for (const { conductorId, fila } of filas) {
    const v = vecinos.get(conductorId) ?? { anterior: null, siguiente: null };
    const fecha = fila.fecha.slice(0, 10);
    if (fecha === fechaAnterior.slice(0, 10) && v.anterior === null) v.anterior = diaDesdeFila(fila);
    if (fecha === fechaSiguiente.slice(0, 10) && v.siguiente === null) v.siguiente = diaDesdeFila(fila);
    vecinos.set(conductorId, v);
  }
  return vecinos;
}

/** Escribe los días de los calendarios en la BD según el campo tocado. */
async function persistirDias(
  ctx: ContextoMes,
  cals: Calendario[],
  alcance: "festivo" | "trabajado" | "trabajadoYVirtual",
): Promise<void> {
  for (const calendario of cals) {
    for (const d of calendario.dias) {
      if (d.id === undefined) continue;
      const set: Partial<typeof diasCalendario.$inferInsert> = {};
      if (alcance === "festivo") {
        set.esFestivo = d.esFestivo;
      } else {
        Object.assign(set, servicioTrabajadoAColumnas(d.servicioTrabajado));
        if (alcance === "trabajadoYVirtual") {
          Object.assign(set, servicioVirtualAColumnas(d.servicioVirtual));
        }
      }
      set.modifiedDate = ctx.ahora;
      set.modifiedBy = ctx.usuarioId;
      await ctx.db.update(diasCalendario).set(set).where(eq(diasCalendario.id, d.id));
    }
  }
}

function errorConvenio(ano: number): Error {
  return new Error(`No existe un convenio válido para ${ano}. Crea uno para que los cálculos sean correctos.`);
}

/** Muestra los festivos de todos los calendarios del mes según el convenio. */
export async function marcarFestivosDelMes(ctx: ContextoMes): Promise<number> {
  const convenio = await convenioDelAño(ctx.db, ctx.ano);
  if (convenio === null) throw errorConvenio(ctx.ano);
  const calc = new CalculosHorario(convenio);
  const cals = await cargarMes(ctx);
  for (const calendario of cals) {
    for (const d of calendario.dias) {
      d.esFestivo = calc.esFestivo(d.fecha, calendario.centro);
    }
  }
  await persistirDias(ctx, cals, "festivo");
  return cals.length;
}

/** Cambia JD por DS o FN donde corresponda (bordes y descansos sueltos). */
export async function ajustarJDsDelMes(ctx: ContextoMes): Promise<number> {
  const cals = await cargarMes(ctx);
  const vecinos = await vecinosDelMes(ctx);
  for (const calendario of cals) {
    const v = vecinos.get(calendario.conductorId) ?? { anterior: null, siguiente: null };
    ajustarJDs(calendario.dias, v.anterior, v.siguiente);
  }
  await persistirDias(ctx, cals, "trabajado");
  return cals.length;
}

/** Recalcula los resúmenes de todos los calendarios del mes (reglas 12). */
export async function recalcularResumenesDelMes(ctx: ContextoMes): Promise<number> {
  const convenio = await convenioDelAño(ctx.db, ctx.ano);
  if (convenio === null) throw errorConvenio(ctx.ano);
  const cals = await cargarMes(ctx);
  const vecinos = await vecinosDelMes(ctx);
  for (const calendario of cals) {
    const v = vecinos.get(calendario.conductorId) ?? { anterior: null, siguiente: null };
    recalcularResumenDominio(calendario, convenio, v.anterior, v.siguiente);
    const resumen = calendario.resumen;
    if (resumen === null || calendario.id === undefined) continue;
    await ctx.db
      .update(resumenes)
      .set({ ...resumenAFila(resumen), modifiedDate: ctx.ahora, modifiedBy: ctx.usuarioId })
      .where(eq(resumenes.calendarioId, calendario.id));
  }
  return cals.length;
}

/** Reaplica los gráficos vigentes a Trabajado y Virtual, y recalcula los resúmenes. */
export async function regenerarTodosDelMes(ctx: ContextoMes): Promise<number> {
  const convenio = await convenioDelAño(ctx.db, ctx.ano);
  if (convenio === null) throw errorConvenio(ctx.ano);
  const cals = await cargarMes(ctx);
  const vecinos = await vecinosDelMes(ctx);
  const { ultimo } = rangoMes(ctx.ano, ctx.mes);

  const centros = [...new Set(cals.map((c) => c.centro))];
  const graficosPorCentro = new Map<number, Grafico[]>();
  for (const centro of centros) {
    const filas = await ctx.db
      .select()
      .from(graficos)
      .where(and(eq(graficos.centro, centro), lte(graficos.fecha, ultimo)));
    graficosPorCentro.set(centro, filas.map(graficoDesdeFila));
  }
  const calc = new CalculosHorario(convenio);
  const vigente = (disponibles: Grafico[], numero: number, fecha: string): Grafico | null => {
    let mejor: Grafico | null = null;
    for (const g of disponibles) {
      if (g.numero !== numero || g.fecha > fecha) continue;
      if (mejor === null || g.fecha > mejor.fecha) mejor = g;
    }
    return mejor;
  };

  for (const calendario of cals) {
    const v = vecinos.get(calendario.conductorId) ?? { anterior: null, siguiente: null };
    const dias = [...calendario.dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const disponibles = graficosPorCentro.get(calendario.centro) ?? [];
    for (let i = 0; i < dias.length; i++) {
      const dia = dias[i] as DiaCalendario;
      const t = dia.servicioTrabajado;
      const grafico = esTrabajo(t.incidencia, t.numero) && t.numero > 0 ? vigente(disponibles, t.numero, dia.fecha) : null;
      calc.regenerarDia(dia, i > 0 ? (dias[i - 1] as DiaCalendario) : v.anterior, i < dias.length - 1 ? (dias[i + 1] as DiaCalendario) : v.siguiente, grafico);
    }
    recalcularResumenDominio(calendario, convenio, v.anterior, v.siguiente);
    const resumen = calendario.resumen;
    if (resumen !== null && calendario.id !== undefined) {
      await ctx.db
        .update(resumenes)
        .set({ ...resumenAFila(resumen), modifiedDate: ctx.ahora, modifiedBy: ctx.usuarioId })
        .where(eq(resumenes.calendarioId, calendario.id));
    }
  }
  await persistirDias(ctx, cals, "trabajadoYVirtual");
  return cals.length;
}

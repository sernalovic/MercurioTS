/**
 * `GET /api/v1/calendarios/basicos` — rejillas de calendarios del
 * escritorio (port de las vistas «básicas» de `CalendariosController`).
 * Un calendario con una cadena de situación por día.
 *
 * Modos:
 * - Por mes:   `?fecha=AAAA-MM&centro=N&tipo=trabajados|anales|virtuales`
 *              (centro 0/ausente = Todos).
 * - Por año:   `?idConductor=A&año=YYYY` (los calendarios del conductor).
 */
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { calendarios, diasCalendario, conductores } from "@mercurio/db";
import { texto as textoIncidencia } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

/** Columna de servicio según la vista pedida. */
function columnas(tipo: string) {
  switch (tipo) {
    case "anuales":
      return {
        incidencia: diasCalendario.AnualIncidencia,
        numero: diasCalendario.AnualNumero,
        codigo: diasCalendario.AnualCodigo,
      };
    case "virtuales":
      return {
        incidencia: diasCalendario.VirtualIncidencia,
        numero: diasCalendario.VirtualNumero,
        codigo: diasCalendario.VirtualCodigo,
      };
    default:
      return {
        incidencia: diasCalendario.TrabajadoIncidencia,
        numero: diasCalendario.TrabajadoNumero,
        codigo: diasCalendario.TrabajadoCodigo,
      };
  }
}

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const idConductor = params.get("idConductor");
  const año = params.get("año");
  const fecha = params.get("fecha");
  const centro = params.get("centro");
  const tipo = params.get("tipo") ?? "trabajados";

  const db = getDb();
  const filtro =
    idConductor !== null && idConductor !== ""
      ? (() => {
          const añoNum = Number(año ?? "");
          if (!Number.isInteger(añoNum) || añoNum < 1900) {
            return Response.json({ error: "Indica el año del calendario (año=AAAA)." }, { status: 400 });
          }
          return and(
            eq(calendarios.conductorId, Number(idConductor)),
            gte(calendarios.fecha, `${añoNum}-01-01`),
            lt(calendarios.fecha, `${añoNum + 1}-01-01`),
          );
        })()
      : (() => {
          if (fecha === null || !/^\d{4}-\d{2}/.test(fecha.slice(0, 7))) {
            return Response.json({ error: "Indica el mes (fecha=AAAA-MM) o un conductor con su año." }, { status: 400 });
          }
          return and(
            eq(calendarios.fecha, `${fecha.slice(0, 7)}-01`),
            centro !== null && centro !== "" && centro !== "0" ? eq(calendarios.centro, Number(centro)) : undefined,
          );
        })();

  if (filtro instanceof Response) return filtro;

  const cabeceras = await db
    .select({
      id: calendarios.id,
      conductorId: calendarios.conductorId,
      centro: calendarios.centro,
      fecha: calendarios.fecha,
      categoria: conductores.categoria,
      situacion: conductores.situacion,
      matricula: conductores.matricula,
    })
    .from(calendarios)
    .innerJoin(conductores, eq(calendarios.conductorId, conductores.id))
    .where(filtro)
    .orderBy(idConductor !== null && idConductor !== "" ? asc(calendarios.fecha) : asc(conductores.matricula));

  const ids = cabeceras.map((c) => c.id);
  const cols = columnas(tipo);
  const dias =
    ids.length > 0
      ? await db
          .select({
            id: diasCalendario.id,
            calendarioId: diasCalendario.calendarioId,
            fecha: diasCalendario.fecha,
            esFestivo: diasCalendario.esFestivo,
            isRemoteUpdated: diasCalendario.isRemoteUpdated,
            incidencia: cols.incidencia,
            numero: cols.numero,
            codigo: cols.codigo,
          })
          .from(diasCalendario)
          .where(inArray(diasCalendario.calendarioId, ids))
          .orderBy(asc(diasCalendario.fecha))
      : [];

  const porCalendario = new Map<number, typeof dias>();
  for (const d of dias) {
    const grupo = porCalendario.get(d.calendarioId) ?? [];
    grupo.push(d);
    porCalendario.set(d.calendarioId, grupo);
  }

  return Response.json({
    calendarios: cabeceras.map((c) => ({
      id: c.id,
      conductorId: c.conductorId,
      centro: c.centro,
      fecha: c.fecha.slice(0, 10),
      categoria: c.categoria,
      situacion: c.situacion,
      matricula: c.matricula,
      tieneDiferenciasEnContra: false, // cálculo del detalle; se porta en M5
      dias: (porCalendario.get(c.id) ?? []).map((d) => ({
        id: d.id,
        fecha: d.fecha.slice(0, 10),
        esFestivo: d.esFestivo,
        situacion: textoIncidencia(d.incidencia, d.numero, d.codigo),
        remoto: d.isRemoteUpdated,
      })),
    })),
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

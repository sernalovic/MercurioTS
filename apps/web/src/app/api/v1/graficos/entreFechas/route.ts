/**
 * `GET /api/v1/graficos/entreFechas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&centro=N`
 * — gráficos del centro con validez en el rango, con sus itinerarios.
 * Formato del dónominio (minutos y céntimos) para que el escritorio los
 * recalcule en el cliente con `CalculosHorario`.
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { graficos, graficoDesdeFila, itinerariosGraficos, aMinutos } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const desde = (params.get("desde") ?? "").slice(0, 10);
  const hasta = (params.get("hasta") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return Response.json({ error: "Indica las fechas de validez (desde y hasta=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }

  const db = getDb();
  const filas = await db
    .select()
    .from(graficos)
    .where(
      and(
        eq(graficos.centro, centro),
        gte(graficos.fecha, `${desde} 00:00:00`),
        lte(graficos.fecha, `${hasta} 00:00:00`),
      ),
    )
    .orderBy(asc(graficos.numero));
  const ids = filas.map((f) => f.id);
  const filasItinerarios = ids.length > 0
    ? await db.select().from(itinerariosGraficos).where(inArray(itinerariosGraficos.graficoId, ids))
    : [];
  const porGrafico = new Map<number, typeof filasItinerarios>();
  for (const i of filasItinerarios) {
    const lista = porGrafico.get(i.graficoId) ?? [];
    lista.push(i);
    porGrafico.set(i.graficoId, lista);
  }

  return Response.json({
    graficos: filas.map((f) => ({
      ...graficoDesdeFila(f),
      itinerarios: (porGrafico.get(f.id) ?? [])
        .map((i) => ({
          id: i.id,
          graficoId: i.graficoId,
          inicio: i.inicio === null ? null : aMinutos(i.inicio),
          itinerario: i.itinerario,
          descripcion: i.descripcion,
          final: i.final === null ? null : aMinutos(i.final),
          tiempoTotal: aMinutos(i.tiempoTotal),
        }))
        .sort((a, b) => (a.inicio ?? Number.MAX_SAFE_INTEGER) - (b.inicio ?? Number.MAX_SAFE_INTEGER)),
    })),
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

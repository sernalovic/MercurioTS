/**
 * `GET /api/v1/graficos/grupos?centro=N` — fechas de validez de los
 * grupos de gráficos del centro, de más reciente a más antiguo (igual
 * que `<GraficosController..grupos>`; centro 0 = Todos suele devolver vacío).
 */
import { desc, eq } from "drizzle-orm";
import { graficos } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const centro = Number(new URL(request.url).searchParams.get("centro") ?? "0");
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  const fechas = centro === 0 ? [] : await getDb()
    .selectDistinct({ fecha: graficos.fecha })
    .from(graficos)
    .where(eq(graficos.centro, centro))
    .orderBy(desc(graficos.fecha));
  return Response.json({ grupos: fechas.map((f) => f.fecha.slice(0, 10)) });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

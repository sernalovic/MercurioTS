/**
 * `GET /api/v1/graficos/diferencias/simples?fecha1=…&fecha2=…&centro=N` —
 * diferencias gráfico a gráfico entre dos grupos (port de
 * `GraficosController.Diferencias`, que usaba `ComparacionGraficos`).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarGrupo, diferenciasGrupos } from "@/lib/informes";
import { CentroTrabajo } from "@mercurio/domain";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha1 = (params.get("fecha1") ?? "").slice(0, 10);
  const fecha2 = (params.get("fecha2") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha1) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha2)) {
    return Response.json({ error: "Indica las dos fechas de validez (fecha1 y fecha2, AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  const db = getDb();
  const [g1, g2] = await Promise.all([
    cargarGrupo(db, fecha1, centro as CentroTrabajo),
    cargarGrupo(db, fecha2, centro as CentroTrabajo),
  ]);
  return Response.json({ diferencias: diferenciasGrupos(g1, g2, fecha1, fecha2) });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

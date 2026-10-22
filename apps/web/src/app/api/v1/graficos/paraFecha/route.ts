/**
 * `GET /api/v1/graficos/paraFecha?numero=N&fecha=AAAA-MM-DD&centro=C` — el
 * gráfico con ese número válido en el MES de la fecha (port de
 * `Api.GraficoParaFechaAsync`): lo usa el detalle del calendario al fijar el
 * número de gráfico de un servicio o al regenerar un día.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarGraficoDeFecha } from "@/lib/detalleCalendario";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const numero = Number(params.get("numero") ?? "0");
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(numero)) {
    return Response.json({ error: "Indica el número de gráfico." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  const grafico = await cargarGraficoDeFecha(getDb(), numero, fecha, centro);
  return Response.json({ grafico });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

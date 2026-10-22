/**
 * `GET /api/v1/calendarios/diasCalendario/dia?fecha=AAAA-MM-DD&idConductor=N` —
 * un día concreto del conductor (port de `Api.DiaAsync`): lo usa el detalle
 * del calendario para los vecinos del líder de descanso (último día del mes
 * anterior y primero del siguiente).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarDia } from "@/lib/detalleCalendario";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const idConductor = Number(params.get("idConductor") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(idConductor) || idConductor <= 0) {
    return Response.json({ error: "Indica el conductor (idConductor=N)." }, { status: 400 });
  }
  const dia = await cargarDia(getDb(), fecha, idConductor);
  return Response.json({ dia });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

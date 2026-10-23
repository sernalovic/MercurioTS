/**
 * `GET /api/v1/calendarios/estadisticas/asignacionGraficos?fecha=AAAA-MM-01&centro=N`
 * — descansos por día, gráficos del grupo vigente para el tipo de día,
 * cuántos están asignados y los no asignados/inexistentes (port de
 * `CalendariosController.AsignacionGraficos`, que alimenta el informe
 * «Asignación de gráficos»).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { asignacionGraficos } from "@/lib/informes";
import { CentroTrabajo } from "@mercurio/domain";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha del mes (fecha=AAAA-MM)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "Centro no válido (el informe necesita un centro concreto)." }, { status: 400 });
  }
  const filas = await asignacionGraficos(getDb(), fecha, centro as CentroTrabajo);
  return Response.json({ asignacion: filas });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * `GET /api/v1/calendarios?fecha=AAAA-MM-01&centro=N` — calendarios del mes
 * con días, resumen y conductor en formato de dominio (port de
 * `CalendariosController.PorFecha`, sin la política Admin del original
 * porque la lectura es común a cualquier sesión, como en el portal).
 * Lo usan el informe «Errores en calendarios» y el Excel crudo.
 */
import { cargarCalendariosDelMes } from "@/lib/informes";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
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
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  const calendarios = await cargarCalendariosDelMes(getDb(), fecha, centro as CentroTrabajo);
  return Response.json({ calendarios });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

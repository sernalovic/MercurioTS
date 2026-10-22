/**
 * `GET /api/v1/nominas/id?fecha=AAAA-MM-DD&idConductor=N` — Id de la nómina
 * mensual del conductor en ese mes, o `0` si no existe (port de
 * `NominasController.IdPorFecha`). Lo usa el botón «Generar nómina» del
 * detalle del calendario antes de regenerarla.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { idNominaDeFecha } from "@/lib/nominasReclamaciones";

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
  const id = await idNominaDeFecha(getDb(), fecha, idConductor);
  return Response.json({ id });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

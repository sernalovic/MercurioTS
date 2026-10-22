/**
 * `GET /api/v1/nominas?idConductor=N` — nóminas del conductor con sus
 * conceptos, más reciente primero (port de `NominasController.Lista`).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarNominas } from "@/lib/nominasReclamaciones";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const idConductor = Number(new URL(request.url).searchParams.get("idConductor") ?? "0");
  if (!Number.isInteger(idConductor) || idConductor <= 0) {
    return Response.json({ error: "Indica el conductor (idConductor=N)." }, { status: 400 });
  }
  const nominas = await cargarNominas(getDb(), idConductor);
  return Response.json({ nominas });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

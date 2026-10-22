/**
 * `GET /api/v1/reclamaciones?idConductor=N` — reclamaciones del conductor con
 * sus conceptos, más reciente primero (port de `ReclamacionesController.Lista`).
 * `POST` — alta del agregado completo (port del `CrudController.Post`, que
 * insertaba la reclamación con sus conceptos en una pasada).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarReclamaciones, crearReclamacion } from "@/lib/nominasReclamaciones";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const idConductor = Number(new URL(request.url).searchParams.get("idConductor") ?? "0");
  if (!Number.isInteger(idConductor) || idConductor <= 0) {
    return Response.json({ error: "Indica el conductor (idConductor=N)." }, { status: 400 });
  }
  const reclamaciones = await cargarReclamaciones(getDb(), idConductor);
  return Response.json({ reclamaciones });
}

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar reclamaciones." }, { status: 403 });
  }
  let entrada: unknown;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    const id = await crearReclamacion(getDb(), entrada, sesion.id, ahora);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

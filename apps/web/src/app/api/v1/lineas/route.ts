/**
 * `GET /api/v1/lineas` — todas las líneas con itinerarios y paradas, por
 * nombre (port de `LineasController.Lista`).
 * `POST` — alta del agregado completo de una línea (port del
 * `CrudController.Post`; el lote `lineas/lista` del original no se usa porque
 * el escritorio guarda línea a línea). Solo administradores en escritura.
 */
import { mensaje } from "@/lib/conveniosLineas";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarLineas, crearLineas } from "@/lib/conveniosLineas";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const lineas = await cargarLineas(getDb());
  return Response.json({ lineas });
}

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar líneas." }, { status: 403 });
  }
  let entrada: unknown;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    const ids = await crearLineas(getDb(), [entrada], sesion.id, ahora);
    return Response.json({ ok: true, id: ids[0] });
  } catch (e) {
    return Response.json({ error: mensaje(e) }, { status: 400 });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

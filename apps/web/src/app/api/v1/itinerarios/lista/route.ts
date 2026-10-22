/**
 * `DELETE /api/v1/itinerarios/lista` — baja de itinerarios por Id (port del
 * `CrudController.DeleteLista` que usaba `LineasViewModel.Guardar`).
 * Solo administradores. El cuerpo es la lista de itinerarios con `id`.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { borrarItinerarios } from "@/lib/conveniosLineas";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar itinerarios." }, { status: 403 });
  }
  let entrada: Array<{ id: number }>;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ids = (entrada ?? []).map((i) => Number(i?.id)).filter((x) => Number.isInteger(x) && x > 0)
    .filter((v, i, a) => a.indexOf(v) === i);
  await borrarItinerarios(getDb(), ids);
  return new Response(null, { status: 204 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

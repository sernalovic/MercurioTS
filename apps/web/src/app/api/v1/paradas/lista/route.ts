/**
 * `DELETE /api/v1/paradas/lista` — baja de paradas por Id (port del
 * `CrudController.DeleteLista` que usaba `LineasViewModel.Guardar`).
 * Solo administradores. El cuerpo es la lista de paradas con `id`.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { borrarParadas } from "@/lib/conveniosLineas";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar paradas." }, { status: 403 });
  }
  let entrada: Array<{ id: number }>;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ids = (entrada ?? []).map((p) => Number(p?.id)).filter((x) => Number.isInteger(x) && x > 0)
    .filter((v, i, a) => a.indexOf(v) === i);
  await borrarParadas(getDb(), ids);
  return new Response(null, { status: 204 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

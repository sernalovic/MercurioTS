/**
 * `DELETE /api/v1/conceptosReclamados/lista` — baja de conceptos reclamados
 * por Id en una pasada con el cuerpo como lista de entidades (port del
 * `CrudController.DeleteLista`, que el escritorio llama antes de guardar).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { borrarConceptosReclamados } from "@/lib/nominasReclamaciones";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar conceptos." }, { status: 403 });
  }
  let entrada: Array<{ id?: number }>;
  try {
    entrada = (await request.json()) as Array<{ id?: number }>;
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  if (!Array.isArray(entrada)) {
    return Response.json({ error: "Se esperaba una lista de conceptos." }, { status: 400 });
  }
  const ids = entrada
    .map((c) => Number(c?.id ?? 0))
    .filter((n) => Number.isInteger(n) && n > 0);
  await borrarConceptosReclamados(getDb(), ids);
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

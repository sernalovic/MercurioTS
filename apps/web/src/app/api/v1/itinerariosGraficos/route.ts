/**
 * `DELETE /api/v1/itinerariosGraficos` con cuerpo de Ids — bajas en lote
 * de itinerarios de gráfico, en el mismo orden que el original (antes de
 * guardar los gráficos).
 */
import { inArray } from "drizzle-orm";
import { itinerariosGraficos } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar itinerarios." }, { status: 403 });
  }
  let ids: number[];
  try {
    ids = (await request.json()) as number[];
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "Se esperaba una lista de Ids." }, { status: 400 });
  }
  const validos = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (validos.length === 0) {
    return Response.json({ error: "Ningún Id de itinerario válido." }, { status: 400 });
  }
  await getDb().delete(itinerariosGraficos).where(inArray(itinerariosGraficos.id, validos));
  return Response.json({ ok: true, total: validos.length });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

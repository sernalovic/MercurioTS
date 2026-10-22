/**
 * `DELETE /api/v1/regulaciones` — bajas en lote de regulaciones de la
 * rejilla del escritorio (el original llamaba `regulaciones/lista`).
 * Cuerpo: lista de Id. Solo administradores.
 */
import { inArray } from "drizzle-orm";
import { regulaciones } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores gestionan regulaciones." }, { status: 403 });
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
  const db = getDb();
  await db.delete(regulaciones).where(inArray(regulaciones.id, ids.map(Number)));
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

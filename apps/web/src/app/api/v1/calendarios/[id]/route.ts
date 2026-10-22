/**
 * `DELETE /api/v1/calendarios/:id` — baja de un calendario del
 * escritorio (los días y el resumen se borran en cascada de la BD).
 */
import { eq } from "drizzle-orm";
import { calendarios } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de calendario no válido." }, { status: 400 });
  }
  const db = getDb();
  await db.delete(calendarios).where(eq(calendarios.id, numero));
  return Response.json({ ok: true });
}

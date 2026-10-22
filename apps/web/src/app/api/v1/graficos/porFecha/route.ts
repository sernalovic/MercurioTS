/**
 * `DELETE /api/v1/graficos/porFecha?fecha=AAAA-MM-DD&centro=N` — baja del
 * grupo completo de gráficos (los itinerarios se borran en cascada), igual
 * que el botón «Borrar grupo» del original.
 */
import { and, eq } from "drizzle-orm";
import { graficos } from "@mercurio/db";
import type { CentroTrabajo } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function DELETE(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar grupos." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha de validez (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  await getDb()
    .delete(graficos)
    .where(and(eq(graficos.centro, centro as CentroTrabajo), eq(graficos.fecha, `${fecha} 00:00:00`)));
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

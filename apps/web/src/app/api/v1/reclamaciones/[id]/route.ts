/**
 * `GET /api/v1/reclamaciones/:id` — reclamación con su conceptos (port del
 * `CrudController.Get`). `PUT` — guarda el agregado; `DELETE` — baja
 * (los conceptos se van por cascada, igual que el original).
 */
import { eq } from "drizzle-orm";
import { reclamaciones as reclamacionesTabla } from "@mercurio/db";
import type { Reclamacion as ReclamacionDominio } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarReclamacion, guardarReclamacion } from "@/lib/nominasReclamaciones";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de reclamación no válido." }, { status: 400 });
  }
  const reclamacion = await cargarReclamacion(getDb(), numero);
  if (reclamacion === null) {
    return Response.json({ error: `No existe una reclamación con Id ${numero}.` }, { status: 404 });
  }
  return Response.json({ reclamacion });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar reclamaciones." }, { status: 403 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de reclamación no válido." }, { status: 400 });
  }
  let entrada: ReclamacionDominio;
  try {
    entrada = (await request.json()) as ReclamacionDominio;
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    await guardarReclamacion(getDb(), numero, entrada, sesion.id, ahora);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const reclamacion = await cargarReclamacion(getDb(), numero);
  return Response.json({ ok: true, reclamacion });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar reclamaciones." }, { status: 403 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de reclamación no válido." }, { status: 400 });
  }
  await getDb().delete(reclamacionesTabla).where(eq(reclamacionesTabla.id, numero));
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

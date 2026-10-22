/**
 * `GET /api/v1/calendarios/:id` — calendario completo en formato de dominio
 * (días con los tres servicios, resumen y conductor con regulaciones) para el
 * detalle del escritorio, que recalcula en el cliente como el original.
 * `PUT` — guarda el calendario editado (días, resumen y totales).
 * `DELETE` — baja del calendario (días y resumen en cascada).
 */
import { eq } from "drizzle-orm";
import { calendarios } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarCalendarioCompleto, guardarCalendarioCompleto } from "@/lib/detalleCalendario";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de calendario no válido." }, { status: 400 });
  }
  const calendario = await cargarCalendarioCompleto(getDb(), numero);
  if (calendario === null) {
    return Response.json({ error: `No existe un calendario con Id ${numero}.` }, { status: 404 });
  }
  return Response.json({ calendario });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar calendarios." }, { status: 403 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de calendario no válido." }, { status: 400 });
  }
  const db = getDb();
  const [existe] = await db.select({ id: calendarios.id }).from(calendarios).where(eq(calendarios.id, numero)).limit(1);
  if (existe === undefined) {
    return Response.json({ error: `No existe un calendario con Id ${numero}.` }, { status: 404 });
  }
  let payload: Parameters<typeof guardarCalendarioCompleto>[2];
  try {
    payload = (await request.json()) as Parameters<typeof guardarCalendarioCompleto>[2];
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    await guardarCalendarioCompleto(db, numero, payload, sesion.id, ahora);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const calendario = await cargarCalendarioCompleto(db, numero);
  return Response.json({ ok: true, calendario });
}

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

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

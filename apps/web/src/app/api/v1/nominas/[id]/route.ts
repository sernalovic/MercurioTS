/**
 * `GET /api/v1/nominas/:id` — nómina con sus conceptos (port del
 * `CrudController.Get`). `PUT` — guarda la nómina recargada desde el escritorio
 * con el agregado completo (columnas + conceptos, port del `CrudController.Put`).
 * `DELETE` — baja de la nómina y sus conceptos en cascada.
 */
import { eq } from "drizzle-orm";
import { nominas as tablaNominas } from "@mercurio/db";
import type { Nomina as NominaDominio } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { cargarNomina, guardarNomina } from "@/lib/nominasReclamaciones";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de nómina no válido." }, { status: 400 });
  }
  const nomina = await cargarNomina(getDb(), numero);
  if (nomina === null) {
    return Response.json({ error: `No existe una nómina con Id ${numero}.` }, { status: 404 });
  }
  return Response.json({ nomina });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar nóminas." }, { status: 403 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de nómina no válido." }, { status: 400 });
  }
  let entrada: NominaDominio;
  try {
    entrada = (await request.json()) as NominaDominio;
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    await guardarNomina(getDb(), numero, entrada, sesion.id, ahora);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const nomina = await cargarNomina(getDb(), numero);
  return Response.json({ ok: true, nomina });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar nóminas." }, { status: 403 });
  }
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    return Response.json({ error: "Identificador de nómina no válido." }, { status: 400 });
  }
  await getDb().delete(tablaNominas).where(eq(tablaNominas.id, numero));
  return Response.json({ ok: true });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

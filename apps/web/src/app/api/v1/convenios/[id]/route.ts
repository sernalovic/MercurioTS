/**
 * `PUT /api/v1/convenios/:id` — guarda el agregado completo del convenio
 * (port del `CrudController.Put`, que con EF `Update` insertaba los hijos
 * nuevos y actualizaba los existentes). `DELETE` — baja del convenio con
 * sus hijos por cascada. Solo administradores, como todo endpoint de
 * escritura del original (política `Admin`).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { borrarConvenio, guardarConvenio, mensaje } from "@/lib/conveniosLineas";

export async function PUT(request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar convenios." }, { status: 403 });
  }
  const id = Number((await contexto.params).id);
  let entrada: unknown;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  try {
    await guardarConvenio(getDb(), id, entrada, sesion.id, new Date().toISOString().slice(0, 19).replace("T", " "));
    return new Response(null, { status: 204 });
  } catch (e) {
    return Response.json({ error: mensaje(e) }, { status: 400 });
  }
}

export async function DELETE(request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden borrar convenios." }, { status: 403 });
  }
  const id = Number((await contexto.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Id no válido." }, { status: 400 });
  }
  const borrado = await borrarConvenio(getDb(), id);
  return borrado ? new Response(null, { status: 204 }) : Response.json({ error: "Convenio no encontrado." }, { status: 404 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

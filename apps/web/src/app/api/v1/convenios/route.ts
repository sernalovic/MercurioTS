/**
 * `GET /api/v1/convenios` — todos los convenios en formato de dominio
 * (minutos y céntimos) con sus opciones de centro, festivos y tablas
 * salariales. Lo usa el escritorio para recalcular gráficos y calendarios
 * en el cliente, igual que el original llamaba a `api/v1/convenios`.
 * `POST` — alta del agregado completo (port del `CrudController.Post` que
 * insertaba el convenio con sus hijos en cascada). Solo administradores.
 */
import { asc } from "drizzle-orm";
import { convenios as tablaConvenios, opcionesCentro, festivos, tablasSalariales, convenioDesdeFilas } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { crearConvenio, mensaje } from "@/lib/conveniosLineas";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const db = getDb();
  const [filas, filasOpciones, filasFestivos, filasTablas] = await Promise.all([
    db.select().from(tablaConvenios).orderBy(asc(tablaConvenios.año)),
    db.select().from(opcionesCentro),
    db.select().from(festivos),
    db.select().from(tablasSalariales),
  ]);
  return Response.json({
    convenios: filas.map((f) => convenioDesdeFilas(f, filasOpciones, filasFestivos, filasTablas)),
  });
}

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden guardar convenios." }, { status: 403 });
  }
  let entrada: unknown;
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  try {
    const id = await crearConvenio(getDb(), entrada, sesion.id, ahora);
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json({ error: mensaje(e) }, { status: 400 });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

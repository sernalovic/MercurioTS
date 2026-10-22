/**
 * `GET /api/v1/convenios` — todos los convenios en formato de dominio
 * (minutos y céntimos) con sus opciones de centro, festivos y tablas
 * salariales. Lo usa el escritorio para recalcular gráficos y calendarios
 * en el cliente, igual que el original llamaba a `api/v1/convenios`.
 */
import { asc } from "drizzle-orm";
import { convenios as tablaConvenios, opcionesCentro, festivos, tablasSalariales, convenioDesdeFilas } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

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

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

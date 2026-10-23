/**
 * `GET /api/v1/itinerarios` — catálogo de itinerarios con sus paradas,
 * por nombre (port de `ItinerariosController.Lista`; lo usa «Extraer
 * gráficos» para completar los finales a partir del número de itinerario).
 */
import { asc } from "drizzle-orm";
import { aMinutos, itinerarios, paradas } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const db = getDb();
  const [filasIt, filasP] = await Promise.all([
    db.select().from(itinerarios).orderBy(asc(itinerarios.nombre)),
    db.select().from(paradas).orderBy(asc(paradas.orden), asc(paradas.id)),
  ]);
  return Response.json({
    itinerarios: filasIt.map((i) => ({
      id: i.id,
      lineaId: i.lineaId,
      nombre: i.nombre,
      descripcion: i.descripcion,
      tiempoReal: i.tiempoReal,
      tiempoPago: i.tiempoPago,
      paradas: filasP
        .filter((p) => p.itinerarioId === i.id)
        .map((p) => ({
          id: p.id,
          itinerarioId: p.itinerarioId,
          orden: p.orden,
          descripcion: p.descripcion,
          tiempo: aMinutos(p.tiempo),
        })),
    })),
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

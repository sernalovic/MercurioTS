/**
 * `GET /api/v1/reclamaciones/estadisticas/conceptosAño?año=AAAA&centro=N` —
 * conceptos reclamados de todo el año (port de
 * `ReclamacionesController.ConceptosAño`, desde el 1/1 al 31/12).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { conceptosReclamados } from "@/lib/informes";
import { CentroTrabajo } from "@mercurio/domain";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const año = Number(params.get("año") ?? "0");
  const centro = Number(params.get("centro") ?? "0");
  if (!Number.isInteger(año) || año < 2000 || año > 2100) {
    return Response.json({ error: "Indica el año (año=AAAA)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  const conceptos = await conceptosReclamados(
    getDb(),
    `${año}-01-01`,
    `${año}-12-01`,
    centro as CentroTrabajo,
  );
  return Response.json({ conceptos });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * `GET /api/v1/reclamaciones/estadisticas/conceptosMes?fecha=AAAA-MM-01&centro=N`
 * — conceptos reclamados del mes (de cualquier conductor del centro) con la
 * matrícula del conductor (port de `ReclamacionesController.ConceptosMes`,
 * que alimenta los informes «Estadísticas de reclamaciones»).
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
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha del mes (fecha=AAAA-MM)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  // ConceptosMes: solo el mes indicado (desde = hasta = ese mes).
  const conceptos = await conceptosReclamados(getDb(), fecha, fecha, centro as CentroTrabajo);
  return Response.json({ conceptos });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

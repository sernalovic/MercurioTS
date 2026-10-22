/**
 * `GET /api/v1/reclamaciones/dcsReclamados?fecha=AAAA-MM-DD&idConductor=N` —
 * importe total de DCs reclamados en reclamaciones aún en curso hasta el mes
 * anterior (port de `Api.ReclamadosEnCursoAsync("dcsReclamados", …)`). Lo usan
 * los saldos del detalle del calendario.
 */
import { TipoReclamacion } from "@mercurio/domain";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { reclamadosEnCurso } from "@/lib/detalleCalendario";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const idConductor = Number(params.get("idConductor") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(idConductor) || idConductor <= 0) {
    return Response.json({ error: "Indica el conductor (idConductor=N)." }, { status: 400 });
  }
  const importe = await reclamadosEnCurso(getDb(), TipoReclamacion.TotalDc, fecha, idConductor);
  return Response.json({ importe });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

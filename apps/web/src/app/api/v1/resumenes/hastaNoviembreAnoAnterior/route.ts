/**
 * `GET /api/v1/resumenes/hastaNoviembreAnoAnterior?matricula=N&hasta=AAAA-MM-DD`
 * — acumulado de resúmenes desde el principio de los datos hasta noviembre del
 * año anterior al de `hasta` (port de `Api.ResumenHastaNoviembreAnoAnteriorAsync`
 * del original, base de los saldos de DCs/DNDs pendientes).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { acumuladoResumenes } from "@/lib/detalleCalendario";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const hasta = (params.get("hasta") ?? "").slice(0, 10);
  const matricula = Number(params.get("matricula") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return Response.json({ error: "Indica el mes hasta (hasta=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(matricula) || matricula <= 0) {
    return Response.json({ error: "Indica la matrícula." }, { status: 400 });
  }
  const resumen = await acumuladoResumenes(
    getDb(),
    matricula,
    "1900-01-01",
    `${Number(hasta.slice(0, 4)) - 1}-11-01`,
  );
  return Response.json({ resumen });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * `GET /api/v1/resumenes/hastaMes?matricula=N&hasta=AAAA-MM-DD` — acumulado de
 * los resúmenes del conductor desde enero de ese año hasta el mes de `hasta`
 * (port de `Api.ResumenHastaMesAsync`): lo usan los saldos del detalle del
 * calendario.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { acumuladoResumenes, mesDe } from "@/lib/detalleCalendario";

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
  const resumen = await acumuladoResumenes(getDb(), matricula, `${hasta.slice(0, 4)}-01-01`, mesDe(hasta));
  return Response.json({ resumen });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

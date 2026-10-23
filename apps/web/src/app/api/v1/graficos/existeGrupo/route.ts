/**
 * `GET /api/v1/graficos/existeGrupo?centro=N&fecha=AAAA-MM-DD` — true si ya
 * hay un grupo de gráficos con esa fecha de validez para el centro (port de
 * `GraficosController.ExisteGrupo`; lo comprueba «Extraer gráficos» antes de
 * guardar).
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { existeGrupo as existeGrupoBD } from "@/lib/informes";
import { CentroTrabajo } from "@mercurio/domain";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const fecha = (params.get("fecha") ?? "").slice(0, 10);
  const centro = Number(params.get("centro") ?? "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return Response.json({ error: "Indica la fecha de validez (fecha=AAAA-MM-DD)." }, { status: 400 });
  }
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }
  return Response.json({ existe: await existeGrupoBD(getDb(), fecha, centro as CentroTrabajo) });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * `POST /api/v1/calendarios/operaciones` — operaciones masivas del mes del
 * escritorio (port de los cuatro POST de `CalendariosController`):
 *
 * ```json
 * { "operacion": "marcarFestivos" | "ajustarJds" | "recalcularResumenes" | "regenerarTodos",
 *   "fecha": "AAAA-MM(-DD)", "centro": 0|1|2|3|4|5 }
 * ```
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import {
  ajustarJDsDelMes, marcarFestivosDelMes, recalcularResumenesDelMes, regenerarTodosDelMes,
  type ContextoMes,
} from "@/lib/calendariosMes";

const OPERACIONES = new Set(["marcarFestivos", "ajustarJds", "recalcularResumenes", "regenerarTodos"]);

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden ejecutar operaciones del mes." }, { status: 403 });
  }

  const cuerpo = (await request.json().catch(() => null)) as {
    operacion?: string;
    fecha?: string;
    centro?: number;
  } | null;
  const operacion = cuerpo?.operacion ?? "";
  if (!OPERACIONES.has(operacion)) {
    return Response.json({ error: "Operación no válida. Usa marcarFestivos, ajustarJds, recalcularResumenes o regenerarTodos." }, { status: 400 });
  }
  const texto = (cuerpo?.fecha ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(texto)) {
    return Response.json({ error: "Indica el mes (fecha=AAAA-MM)." }, { status: 400 });
  }
  const [ano, mes] = texto.split("-").map(Number) as [number, number];
  const centro = Number(cuerpo?.centro ?? 0);
  if (!Number.isInteger(centro) || centro < 0 || centro > 5) {
    return Response.json({ error: "Centro no válido." }, { status: 400 });
  }

  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  const ctx: ContextoMes = { db: getDb(), ano, mes, centro, usuarioId: sesion.id, ahora };
  try {
    const total =
      operacion === "marcarFestivos" ? await marcarFestivosDelMes(ctx)
      : operacion === "ajustarJds" ? await ajustarJDsDelMes(ctx)
      : operacion === "recalcularResumenes" ? await recalcularResumenesDelMes(ctx)
      : await regenerarTodosDelMes(ctx);
    return Response.json({ ok: true, total });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

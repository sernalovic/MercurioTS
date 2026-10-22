/**
 * `POST /api/v1/calendarios/pegar` — crea los calendarios del mes a partir
 * del texto pegado desde Excel (port de `CrearDesdePegado`, el parseo va
 * ahora en el servidor):
 *
 * ```json
 * { "fecha": "AAAA-MM(-DD)", "centro": 1|2|… (no 0), "texto": "…",
 *   "confirmado": false }
 * ```
 *
 * Sin `confirmado` devuelve `requiereConfirmacion: true` cuando al centro
 * le faltan los 14 festivos del convenio; el cliente pide confirmación y
 * repite el envío.
 */
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";
import { pegarCalendarios, type ContextoMes } from "@/lib/calendariosMes";

export async function POST(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden añadir calendarios." }, { status: 403 });
  }

  const cuerpo = (await request.json().catch(() => null)) as {
    fecha?: string;
    centro?: number;
    texto?: string;
    confirmado?: boolean;
  } | null;
  const texto = (cuerpo?.fecha ?? "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(texto)) {
    return Response.json({ error: "Indica el mes (fecha=AAAA-MM)." }, { status: 400 });
  }
  const centro = Number(cuerpo?.centro ?? 0);
  if (!Number.isInteger(centro) || centro < 1 || centro > 5) {
    return Response.json({ error: "No se pueden añadir calendarios en todos los centros." }, { status: 400 });
  }
  if (!String(cuerpo?.texto ?? "").trim()) {
    return Response.json({ error: "Pega el texto de los calendarios desde Excel." }, { status: 400 });
  }

  const [ano, mes] = texto.split("-").map(Number) as [number, number];
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  const ctx: ContextoMes = { db: getDb(), ano, mes, centro, usuarioId: sesion.id, ahora };
  try {
    const resultado = await pegarCalendarios(ctx, String(cuerpo?.texto ?? ""), cuerpo?.confirmado === true);
    return Response.json({ ok: true, ...resultado });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

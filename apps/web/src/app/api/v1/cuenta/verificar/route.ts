/**
 * Comprobación del token de la aplicación de escritorio:
 * `GET /api/v1/cuenta/verificar` con `Authorization: Bearer <token>`.
 * Devuelve los claims si el token es válido; 401 si no lo es.
 */
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  return Response.json({ sesion });
}

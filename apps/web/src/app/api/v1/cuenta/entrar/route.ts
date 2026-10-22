/**
 * Acceso para la aplicación de escritorio: `POST /api/v1/cuenta/entrar`.
 * Verifica el usuario de ASP.NET Identity y devuelve un token Bearer con
 * la misma vida que la cookie web (14 días) y la fecha de expiración
 * para mostrarla en la barra del escritorio.
 */
import { entrarCon } from "@/lib/autenticacion";
import { DIAS_SESION, emitirToken } from "@/lib/sesion";

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await request.json().catch(() => null) as {
    usuario?: string;
    clave?: string;
  } | null;

  const usuario = cuerpo?.usuario?.trim() ?? "";
  if (usuario === "" || !cuerpo?.clave) {
    return Response.json({ error: "Introduce el usuario y la clave." }, { status: 400 });
  }

  const intento = await entrarCon(usuario, cuerpo.clave);
  if ("error" in intento) {
    return Response.json({ error: intento.error }, { status: 401 });
  }

  const token = await emitirToken(intento.sesion);
  return Response.json({
    token,
    expira: Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000,
    usuario: {
      id: intento.sesion.id,
      nombre: intento.sesion.nombre,
      matricula: intento.sesion.matricula,
      esAdmin: intento.sesion.esAdmin,
      esSuper: intento.sesion.esSuper,
    },
  });
}

export function OPTIONS(): Response {
  // Preflight de CORS (las cabeceras se añaden en next.config.ts).
  return new Response(null, { status: 204 });
}

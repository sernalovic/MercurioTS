/**
 * `PUT /api/v1/cuenta/usuarios/:id/permisos` — cambia los permisos de un
 * usuario del portal (port de `AccountController.Permisos`, con la política
 * `Super` del original: solo un súper puede guardarlos). El bloqueo usa el
 * `LockoutEnd` de Identity (fijado al máximo en vigor).
 */
import { eq } from "drizzle-orm";
import { aspNetUsers } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function PUT(request: Request, contexto: { params: Promise<{ id: string }> }): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esSuper) {
    return Response.json({ error: "Solo un superusuario puede cambiar los permisos." }, { status: 403 });
  }
  const id = Number((await contexto.params).id);
  let entrada: { isAdmin?: boolean; isSuper?: boolean; isAfiliado?: boolean; isLocked?: boolean };
  try {
    entrada = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo no válido." }, { status: 400 });
  }
  const db = getDb();
  const [usuario] = await db.select().from(aspNetUsers).where(eq(aspNetUsers.id, id)).limit(1);
  if (usuario === undefined) {
    return Response.json({ error: "Usuario no encontrado." }, { status: 404 });
  }
  await db.update(aspNetUsers).set({
    isAdmin: Boolean(entrada.isAdmin),
    isSuper: Boolean(entrada.isSuper),
    isAfiliado: Boolean(entrada.isAfiliado),
    lockoutEnd: entrada.isLocked === true
      ? "9999-12-31 00:00:00+00" // DateTimeOffset.MaxValue del original
      : null,
  }).where(eq(aspNetUsers.id, id));
  return new Response(null, { status: 204 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * `GET /api/v1/cuenta/usuarios` — lista básica de usuarios del portal para
 * la pantalla «Usuarios» del escritorio (port de `AccountController.Basicos`,
 * con política Admin). Los permisos se cambian aparte con `…/permisos`,
 * reservado a los súper (igual que allí).
 */
import { asc } from "drizzle-orm";
import { aspNetUsers } from "@mercurio/db";
import { getDb } from "@/lib/bd";
import { obtenerSesionDePeticion } from "@/lib/sesion";

export async function GET(request: Request): Promise<Response> {
  const sesion = await obtenerSesionDePeticion(request);
  if (!sesion) {
    return Response.json({ error: "Sesión no válida" }, { status: 401 });
  }
  if (!sesion.esAdmin) {
    return Response.json({ error: "Solo los administradores pueden ver los usuarios." }, { status: 403 });
  }
  const filas = await getDb().select().from(aspNetUsers).orderBy(asc(aspNetUsers.matricula));
  return Response.json({
    usuarios: filas.map((u) => ({
      id: u.id,
      userName: u.userName,
      emailConfirmed: u.emailConfirmed,
      matricula: u.matricula,
      nombre: u.nombre,
      apellidos: u.apellidos,
      fechaAlta: u.fechaAlta.slice(0, 10),
      isAfiliado: u.isAfiliado,
      isAdmin: u.isAdmin,
      isSuper: u.isSuper,
      isLocked: u.lockoutEnd !== null,
      email: u.email,
    })),
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}

/**
 * Trabajador vinculado a la sesión (AspNetUsers.Matricula → Conductores).
 * Devuelve `null` si la cuenta no tiene sesión o no tiene trabajador
 * (por ejemplo el administrador sin matrícula).
 */
import { eq } from "drizzle-orm";
import { conductores, type Db } from "@mercurio/db";
import { obtenerSesion, type SesionInfo } from "@/lib/sesion";

export async function conductorDeCesion(
  db: Db,
): Promise<{ sesion: SesionInfo; conductor: typeof conductores.$inferSelect } | null> {
  const sesion = await obtenerSesion();
  if (sesion === null) return null;
  if (sesion.matricula > 0) {
    const [conductor] = await db
      .select()
      .from(conductores)
      .where(eq(conductores.matricula, sesion.matricula))
      .limit(1);
    if (conductor !== undefined) return { sesion, conductor };
  }
  return null;
}

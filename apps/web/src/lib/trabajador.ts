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

/** Ficha del trabajador editable en "Datos de trabajador/a". */
export interface DatosConductor {
  nombre: string;
  apellidos: string;
  email: string | null;
  telefono: string | null;
  /** "YYYY-MM-DD HH:mm:ss" */
  fechaAntiguedad: string;
  porcentajeIrpf: string;
}

/**
 * Guarda la ficha del trabajador (pantalla "Datos de trabajador/a"). NO toca
 * la cuenta de usuario: cambiar el email aquí no cambia el email del login.
 */
export async function guardarDatosConductor(
  db: Db,
  args: { usuarioId: number; conductorId: number; datos: DatosConductor },
): Promise<void> {
  const ahora = new Date().toISOString().slice(0, 19).replace("T", " ");
  await db.update(conductores)
    .set({
      nombre: args.datos.nombre,
      apellidos: args.datos.apellidos,
      email: args.datos.email,
      telefono: args.datos.telefono,
      fechaAntiguedad: args.datos.fechaAntiguedad,
      porcentajeIrpf: args.datos.porcentajeIrpf,
      modifiedDate: ahora,
      modifiedBy: args.usuarioId,
    })
    .where(eq(conductores.id, args.conductorId));
}

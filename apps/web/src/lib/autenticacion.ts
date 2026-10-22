/**
 * Autenticación compartida entre el acceso web y la API `/api/v1` que
 * usa la aplicación de escritorio.
 *
 * Port de `Cuenta.cshtml.cs` (`PasswordSignInAsync`) del sistema anterior:
 * busca el usuario por su UserName normalizado, verifica el hash de
 * ASP.NET Identity y aplica el bloqueo del original (5 intentos fallidos
 * → 5 minutos). No crea la sesión: cada cliente la crea a su manera
 * (la web en cookie, el escritorio con token Bearer).
 */
import { eq, sql } from "drizzle-orm";
import { aspNetUsers } from "@mercurio/db";
import { verificarContrasena } from "@mercurio/db/contrasena";
import { getDb } from "@/lib/bd";
import type { SesionInfo } from "@/lib/sesion";

const INTENTOS_BLOQUEO = 5; // Identity: Lockout.MaxFailedAccessAttempts
const MINUTOS_BLOQUEO = 5; // identidad: duración de bloqueo por defecto

export type IntentoDeAcceso = { sesion: SesionInfo } | { error: string };

export async function entrarCon(usuario: string, clave: string): Promise<IntentoDeAcceso> {
  const db = getDb();
  const [encontrado] = await db.select()
    .from(aspNetUsers)
    .where(eq(aspNetUsers.normalizedUserName, usuario.toUpperCase()))
    .limit(1);

  if (!encontrado?.passwordHash) {
    // Respuesta igual con usuario inexistente o sin clave: no revela cuentas.
    return { error: "Usuario o contraseña no válidos" };
  }

  // Bloqueo vigente: Identity guarda la fecha con zona horaria.
  if (encontrado.lockoutEnd !== null && new Date(normalizarHoraria(encontrado.lockoutEnd)) > new Date()) {
    return { error: "Usuario bloqueado. Consulte con el administrador." };
  }

  if (!verificarContrasena(encontrado.passwordHash, clave)) {
    await db.update(aspNetUsers)
      .set({
        accessFailedCount: sql`${aspNetUsers.accessFailedCount} + 1`,
        lockoutEnd: encontrado.accessFailedCount + 1 >= INTENTOS_BLOQUEO
          ? sumarMinutos(MINUTOS_BLOQUEO)
          : null,
      })
      .where(eq(aspNetUsers.id, encontrado.id));
    return { error: "Usuario o contraseña no válidos" };
  }

  await db.update(aspNetUsers)
    .set({ accessFailedCount: 0, lockoutEnd: null })
    .where(eq(aspNetUsers.id, encontrado.id));

  return {
    sesion: {
      id: encontrado.id,
      nombre: `${encontrado.nombre} ${encontrado.apellidos}`.trim(),
      matricula: encontrado.matricula,
      esAdmin: encontrado.isAdmin,
      esSuper: encontrado.isSuper,
    },
  };
}

/** "2026-10-20 16:15:00+00" → cadena que `new Date()` entiende siempre. */
function normalizarHoraria(valor: string): string {
  const normalizado = valor.replace(" ", "T");
  return /([+-]\d{2})$/.test(normalizado) ? `${normalizado}:00` : normalizado;
}

function sumarMinutos(minutos: number): string {
  const fecha = new Date(Date.now() + minutos * 60_000);
  return `${fecha.toISOString().replace("T", " ").slice(0, 19)}+00`;
}

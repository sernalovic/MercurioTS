"use server";

/**
 * Inicio de sesión portado de `Cuenta.cshtml.cs` (PasswordSignInAsync):
 * - busca el usuario por su UserName normalizado,
 * - verifica el hash de ASP.NET Identity,
 * - aplica el bloqueo del original (5 intentos fallidos → 5 minutos),
 * - crea la cookie de sesión y redirige al portal.
 */
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { aspNetUsers } from "@mercurio/db";
import { verificarContrasena } from "@mercurio/db/contrasena";
import { getDb } from "@/lib/bd";
import { crearSesion } from "@/lib/sesion";

const INTENTOS_BLOQUEO = 5; // Identity: Lockout.MaxFailedAccessAttempts
const MINUTOS_BLOQUEO = 5; // Identity: duración de bloqueo por defecto

export async function iniciarSesion(estado: string | null, formData: FormData): Promise<string | null> {
  const usuario = String(formData.get("usuario") ?? "").trim();
  const clave = String(formData.get("clave") ?? "");

  if (usuario === "" || clave === "") return "Introduce el usuario y la clave.";

  const db = getDb();
  const [encontrado] = await db.select()
    .from(aspNetUsers)
    .where(eq(aspNetUsers.normalizedUserName, usuario.toUpperCase()))
    .limit(1);

  if (!encontrado?.passwordHash) {
    // Respuesta igual con usuario inexistente o sin clave: no revela cuentas.
    return "Usuario o contraseña no válidos";
  }

  // Bloqueo vigente: Identity guarda la fecha con zona horaria.
  if (encontrado.lockoutEnd !== null && new Date(normalizarHoraria(encontrado.lockoutEnd)) > new Date()) {
    return "Usuario bloqueado. Consulte con el administrador.";
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
    return "Usuario o contraseña no válidos";
  }

  await db.update(aspNetUsers)
    .set({ accessFailedCount: 0, lockoutEnd: null })
    .where(eq(aspNetUsers.id, encontrado.id));

  const nombreCompleto = `${encontrado.nombre} ${encontrado.apellidos}`.trim();
  await crearSesion({
    id: encontrado.id,
    nombre: nombreCompleto,
    matricula: encontrado.matricula,
    esAdmin: encontrado.isAdmin,
    esSuper: encontrado.isSuper,
  });

  redirect("/portal"); // LoginModel: LocalRedirect…"/Portal"
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

/**
 * Sesión de la web: JWT HS256 en una cookie httpOnly.
 *
 * Port del patrón del sistema anterior (cookie de Identity, 14 días) con los
 * mismos claims: sub (Id de `AspNetUsers`), nombre, matricula y roles
 * Admin/Super (equivalentes a las políticas del original).
 */
import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const NOMBRE_COOKIE = "Mercurio.Sesion";
const DIAS_SESION = 14; // ConfigureApplicationCookie.ExpireTimeSpan del original

export interface SesionInfo {
  id: number;
  nombre: string;
  matricula: number;
  esAdmin: boolean;
  esSuper: boolean;
}

function contrasena(): string {
  const secreto = process.env.MERCURIO_SECRETO;
  if (!secreto) {
    throw new Error(
      "Falta MERCURIO_SECRETO en el entorno (copia apps/web/.env.example a apps/web/.env.local).",
    );
  }
  return secreto;
}

/** Crea el JWT de sesión y lo deja en la cookie. */
export async function crearSesion(info: SesionInfo): Promise<void> {
  const token = await new SignJWT({
    nombre: info.nombre,
    matricula: info.matricula,
    esAdmin: info.esAdmin,
    esSuper: info.esSuper,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(info.id))
    .setIssuer("mercurio") // Jwt:Issuer del original
    .setIssuedAt()
    .setExpirationTime(`${DIAS_SESION}d`)
    .sign(new TextEncoder().encode(contrasena()));

  (await cookies()).set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESION * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Lee y valida la cookie de sesión; `null` si no hay sesión válida. */
export async function obtenerSesion(): Promise<SesionInfo | null> {
  const valor = (await cookies()).get(NOMBRE_COOKIE)?.value;
  if (!valor) return null;
  try {
    const { payload } = await jwtVerify(
      valor,
      new TextEncoder().encode(contrasena()),
      { issuer: "mercurio" },
    );
    return {
      id: Number(payload.sub),
      nombre: String(payload.nombre ?? ""),
      matricula: Number(payload.matricula ?? 0),
      esAdmin: payload.esAdmin === true,
      esSuper: payload.esSuper === true,
    };
  } catch {
    return null;
  }
}

/** Borra la cookie de sesión (solo en Server Actions / Route Handlers). */
export async function cerrarSesion(): Promise<void> {
  (await cookies()).delete(NOMBRE_COOKIE);
}

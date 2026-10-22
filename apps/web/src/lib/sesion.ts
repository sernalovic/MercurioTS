/**
 * Sesi\u00f3n compartida: JWT HS256 firmado con `MERCURIO_SECRETO`.
 *
 * - La web lo guarda en una cookie httpOnly (misma vida que el original:
 *   14 d\u00edas, `ConfigureApplicationCookie.ExpireTimeSpan`).
 * - La aplicaci\u00f3n de escritorio lo recibe de `POST /api/v1/cuenta/entrar`
 *   y lo env\u00eda en la cabecera `Authorization: Bearer …` de cada consulta.
 *
 * Mismos claims que el original: sub (Id de `AspNetUsers`), nombre,
 * matr\u00edcula y roles Admin/Super (equivalentes a las pol\u00edticas del original).
 */
import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const NOMBRE_COOKIE = "Mercurio.Sesion";
export const DIAS_SESION = 14; // ConfigureApplicationCookie.ExpireTimeSpan del original

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

/** Firmar el token con los claims de la sesi\u00f3n (compartida web/escritorio). */
export async function emitirToken(info: SesionInfo): Promise<string> {
  return new SignJWT({
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
}

/** Crea el JWT de sesi\u00f3n y lo deja en la cookie. */
export async function crearSesion(info: SesionInfo): Promise<void> {
  const token = await emitirToken(info);
  (await cookies()).set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESION * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Lee y devuelve el token indicado; `null` si no es v\u00e1lido. */
export async function decodificarSesion(token: string | undefined): Promise<SesionInfo | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(contrasena()), {
      issuer: "mercurio",
    });
    return {
      id: Number(payload.sub),
      nombre: String(payload.nombre ?? ""),
      matricula: Number(payload.matricula ?? 0),
      esAdmin: Boolean(payload.esAdmin),
      esSuper: Boolean(payload.esSuper),
    };
  } catch {
    return null;
  }
}

/** Lee y valida la cookie de sesi\u00f3n; `null` si no hay sesi\u00f3n v\u00e1lida. */
export async function obtenerSesion(): Promise<SesionInfo | null> {
  const valor = (await cookies()).get(NOMBRE_COOKIE)?.value;
  if (!valor) return null;
  return decodificarSesion(valor);
}

/** Sesión de una petición de la API: `Authorization: Bearer <token>`. */
export async function obtenerSesionDePeticion(request: Request): Promise<SesionInfo | null> {
  const cabecera = request.headers.get("authorization") ?? "";
  if (!cabecera.toLowerCase().startsWith("bearer ")) return null;
  return decodificarSesion(cabecera.slice(7).trim());
}

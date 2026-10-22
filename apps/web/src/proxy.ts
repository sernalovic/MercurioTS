import { NextResponse, type NextRequest } from "next/server";

/**
 * Chequeo optimístico de sesión a la salida del borde (port de
 * ConfigureApplicationCookie: LoginPath "/acceso"). Solo mira la EXISTENCIA
 * de una cookie con forma de JWT (xxx.yyy.zzz); la validación real del JWT
 * ocurre en cada servidor que la lee, y las Server Actions se revalidan por
 * su cuenta.
 *
 * Deliberadamente NO redirige /acceso → /portal: eso lo hace la propia
 * página de acceso con la sesión verificada, evitando bucles cuando la
 * cookie existe pero es inválida.
 */
const CONFORMA_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function proxy(request: NextRequest) {
  // La API `/api/v1` se autentica con token Bearer (escritorio), no con
  // la cookie: no entra en este chequeo.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get("Mercurio.Sesion")?.value;
  const conSesion = cookie !== undefined && CONFORMA_JWT.test(cookie);

  if (!conSesion && request.nextUrl.pathname !== "/acceso") {
    return NextResponse.redirect(new URL("/acceso", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Excluidos solo los estáticos; el resto de rutas pasa por el chequeo.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|privacidad).*)"],
};

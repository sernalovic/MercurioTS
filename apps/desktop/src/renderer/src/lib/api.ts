/**
 * Cliente HTTP de la API `/api/v1` del servidor indicado (por defecto
 * la web de Vercel). Cada llamada lleva el token Bearer obtenido en
 * `POST /api/v1/cuenta/entrar` — igual que el original usaba su Bearer
 * JWT contra `Mercurio.Api`.
 */

export interface SesionInfo {
  id: number;
  nombre: string;
  matricula: number;
  esAdmin: boolean;
  esSuper: boolean;
}

interface RespuestaLogin {
  token: string;
  expira: number;
  usuario: SesionInfo;
}

function base(servidor: string): string {
  return servidor.trim().replace(/\/+$/, "");
}

async function pedir<T>(
  servidor: string,
  ruta: string,
  token: string | null,
  metodo: "GET" | "POST" | "PUT" | "DELETE",
  cuerpo?: unknown,
): Promise<T> {
  const respuesta = await fetch(`${base(servidor)}/api/v1/${ruta}`, {
    method: metodo,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = (await respuesta.json().catch(() => ({}))) as { error?: string } & T;
  if (!respuesta.ok) {
    throw new Error(datos?.error ?? `Error ${respuesta.status} del servidor`);
  }
  return datos;
}

/** `POST /api/v1/cuenta/entrar` — devuelve el token y el usuario. */
export function entrar(servidor: string, usuario: string, clave: string): Promise<RespuestaLogin> {
  return pedir<RespuestaLogin>(servidor, "cuenta/entrar", null, "POST", { usuario, clave });
}

/** `GET /api/v1/cuenta/verificar` — validez del token guardado. */
export function verificar(servidor: string, token: string): Promise<{ sesion: SesionInfo }> {
  return pedir<{ sesion: SesionInfo }>(servidor, "cuenta/verificar", token, "GET");
}

/** Llamada autenticada genérica para el resto de pantallas. */
export function api<T>(
  servidor: string,
  token: string,
  ruta: string,
  valores?: { metodo?: "GET" | "POST" | "PUT" | "DELETE"; cuerpo?: unknown },
): Promise<T> {
  return pedir<T>(servidor, ruta, token, valores?.metodo ?? "GET", valores?.cuerpo);
}

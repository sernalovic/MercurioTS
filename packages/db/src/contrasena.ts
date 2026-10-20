/**
 * Hash de contraseñas compatible con ASP.NET Core Identity.
 *
 * El sistema anterior (`Mercurio.Api`) usaba `PasswordHasher<Usuario>`, cuyo
 * formato v3 es PBKDF2 con estos parámetros codificados en el propio hash:
 *
 *   [0x01] [prf: uint32 BE] [iteraciones: uint32 BE] [longitudSal: uint32 BE] [sal] [subclave]
 *
 * con prf: 0 = HMACSHA1, 1 = HMACSHA256, 2 = HMACSHA512 (valores por defecto
 * de Identity: 1, 10.000 iteraciones, sal de 16 bytes). Aquí se pueden
 * generar hashes nuevos con iteraciones mayores porque el verificador lee
 * los parámetros de la cabecera.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const PRF = {
  0: "sha1",
  1: "sha256",
  2: "sha512",
} as const;

interface HashIdentity {
  formato: number;
  prf: keyof typeof PRF;
  iteraciones: number;
  sal: Buffer;
  subclave: Buffer;
}

function decodificar(hash: string): HashIdentity {
  const bytes = Buffer.from(hash, "base64");
  if (bytes.length < 13 || bytes[0] !== 0x01) {
    throw new Error("Formato de hash de ASP.NET Identity no reconocido (se espera v3).");
  }
  const prf = bytes.readUint32BE(1) as keyof typeof PRF;
  if (!(prf in PRF)) throw new Error(`Prf desconocido: ${prf}`);
  const iteraciones = bytes.readUint32BE(5);
  const longitudSal = bytes.readUint32BE(9);
  const sal = bytes.subarray(13, 13 + longitudSal);
  const subclave = bytes.subarray(13 + longitudSal);
  if (sal.length !== longitudSal || subclave.length === 0) {
    throw new Error("Hash de ASP.NET Identity truncado.");
  }
  return { formato: 1, prf, iteraciones, sal, subclave };
}

export const ITERACIONES_CONTRASENA = 100_001;

/** Genera un hash en formato v3 de ASP.NET Identity para la clave indicada. */
export function hashContrasena(
  contrasena: string,
  { iteraciones = ITERACIONES_CONTRASENA, prf = 1 as keyof typeof PRF }: {
    iteraciones?: number;
    prf?: keyof typeof PRF;
  } = {},
): string {
  const sal = randomBytes(16);
  const subclave = pbkdf2Sync(contrasena, sal, iteraciones, 32, PRF[prf]);
  const cabecera = Buffer.alloc(13);
  cabecera[0] = 0x01;
  cabecera.writeUint32BE(prf, 1);
  cabecera.writeUint32BE(iteraciones, 5);
  cabecera.writeUint32BE(sal.length, 9);
  return Buffer.concat([cabecera, sal, subclave]).toString("base64");
}

/** Verifica una clave contra un hash de ASP.NET Identity. Tiempo constante. */
export function verificarContrasena(hash: string, contrasena: string): boolean {
  try {
    const h = decodificar(hash);
    const calculada = pbkdf2Sync(contrasena, h.sal, h.iteraciones, h.subclave.length, PRF[h.prf]);
    return timingSafeEqual(calculada, h.subclave);
  } catch {
    return false;
  }
}

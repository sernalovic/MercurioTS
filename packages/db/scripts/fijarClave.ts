/**
 * Fija (o restablece) la contraseña de un usuario de la BD indicada,
 * generando un hash v3 de ASP.NET Identity (compatible con el original
 * y con el verificador del portal).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL = 'cadena de la BD (Neon o local)'
 *   node --experimental-transform-types scripts/fijarClave.ts usuario clave
 *
 * El usuario se busca por UserName normalizado (mayúsculas), igual que el
 * acceso del portal. Nunca imprime la clave: solo confirma la cuenta.
 */
import pg from "pg";
import { hashContrasena, ITERACIONES_CONTRASENA } from "../src/contrasena.ts";

const [usuario, clave] = process.argv.slice(2);
if (!usuario || !clave) {
  console.error("Uso: node --experimental-transform-types scripts/fijarClave.ts <usuario> <clave>");
  process.exit(1);
}
if (clave.length < 8) {
  console.error("La clave debe tener al menos 8 caracteres.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const hash = hashContrasena(clave, { iteraciones: ITERACIONES_CONTRASENA });
  const encontrado = await pool.query(
    `SELECT "Id", "UserName" FROM "AspNetUsers" WHERE "NormalizedUserName" = $1 LIMIT 1`,
    [usuario.toUpperCase()],
  );
  if (encontrado.rows.length === 0) {
    console.error(`No existe ningún usuario "${usuario}" en la BD.`);
    process.exit(1);
  }
  const fila = encontrado.rows[0];
  await pool.query(
    `UPDATE "AspNetUsers"
        SET "PasswordHash" = $1, "SecurityStamp" = $2, "ConcurrencyStamp" = $3,
            "AccessFailedCount" = 0, "LockoutEnd" = NULL
      WHERE "Id" = $4`,
    [hash, crypto.randomUUID(), crypto.randomUUID(), fila.Id],
  );
  console.log(`Clave actualizada para "${fila.UserName}" (Id ${fila.Id}).`);
} finally {
  await pool.end();
}

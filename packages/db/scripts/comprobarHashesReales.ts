/**
 * Comprueba, sobre los hashes REALES de la BD del sistema anterior (solo
 * lectura), que el verificador de este paquete interpreta el formato como lo
 * haría ASP.NET Identity. No se imprime ningún hash; no se toca la BD.
 * Uso: DATABASE_URL_ORIGINAL=postgresql://... node scripts/comprobarHashesReales.ts
 */
import pg from "pg";
import { verificarContrasena } from "../src/contrasena.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_ORIGINAL });
try {
  const { rows } = await pool.query(
    `SELECT "Id", "UserName", "PasswordHash" FROM "AspNetUsers"
     WHERE "PasswordHash" IS NOT NULL ORDER BY "Id" LIMIT 3`,
  );
  for (const f of rows) {
    const hash = f.PasswordHash as string;
    const v3 = hash.startsWith("AQAAAA");
    const bytes = Buffer.from(hash, "base64").length; // 61 = 13 cabecera + 16 sal + 32 subclave
    const rechaza = verificarContrasena(hash, "clave-equivocada-de-prueba");
    console.log(
      `Usuario "${f.UserName}" (Id ${f.Id}): v3=${v3}, bytes=${bytes}, rechaza clave falsa=${rechaza}`,
    );
  }
  if (rows.length === 0) console.log("No hay hashes que comprobar.");
} finally {
  await pool.end();
}

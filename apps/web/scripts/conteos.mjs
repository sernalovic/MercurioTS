/* Comprueba conteos básicos de la BD de desarrollo (convenios, líneas, nóminas). */
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query('SELECT COUNT(*) AS n FROM "Convenios"');
const l = await pool.query('SELECT COUNT(*) AS n FROM "Lineas"');
const nom = await pool.query('SELECT COUNT(*) AS n FROM "Nominas"');
const rec = await pool.query('SELECT COUNT(*) AS n FROM "Reclamaciones"');
console.log(
  "convenios:", r.rows[0].n,
  "| lineas:", l.rows[0].n,
  "| nominas:", nom.rows[0].n,
  "| reclamaciones:", rec.rows[0].n,
);
await pool.end();

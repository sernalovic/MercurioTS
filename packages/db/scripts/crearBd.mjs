/* Crea la BD `mercurio_ts` si no existe, leyendo la clave del .env.local (sin imprimirla). */
import fs from "fs";
import pg from "pg";

const env = fs.readFileSync("../../apps/web/.env.local", "utf8");
const m = /^DATABASE_URL=postgresql:\/\/postgres:([^@]+)@localhost:5432\/mercurio_ts$/m.exec(env);
if (m === null) { console.log("no se pudo leer DATABASE_URL"); process.exit(1); }
const clave = m[1];
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:${encodeURIComponent(clave)}@localhost:5432/postgres`,
});
try {
  await pool.query("CREATE DATABASE mercurio_ts");
  console.log("BD mercurio_ts creada");
} catch (e) {
  console.log("crear BD:", String(e.message).slice(0, 120));
}
await pool.end();

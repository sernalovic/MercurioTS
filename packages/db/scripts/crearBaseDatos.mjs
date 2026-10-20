/**
 * Crea la base de datos `mercurio_ts` en el Postgres local si no existe.
 * Toma las credenciales de `DATABASE_URL` (definida en `.env.local`, gitignored)
 * y conecta a la BD de mantenimiento `postgres` para poder ejecutar CREATE DATABASE.
 */
import pg from "pg";

const url = new URL(process.env.DATABASE_URL);
url.pathname = "/postgres";

const cliente = new pg.Client({ connectionString: url.toString() });
await cliente.connect();
try {
  const existe = await cliente.query(
    "SELECT 1 FROM pg_database WHERE datname = 'mercurio_ts'",
  );
  if (existe.rowCount === 0) {
    await cliente.query("CREATE DATABASE mercurio_ts");
    console.log("Base de datos 'mercurio_ts' creada.");
  } else {
    console.log("Base de datos 'mercurio_ts' ya existía.");
  }
} finally {
  await cliente.end();
}

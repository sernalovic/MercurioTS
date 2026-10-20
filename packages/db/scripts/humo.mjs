/**
 * Prueba de humo sobre la BD ya migrada: crea la cadena Lineas → Itinerarios
 * → Paradas (identidad, FK en cascada e `interval`), verifica el borrado en
 * cascada y consulta los catálogos. No toca tablas del original.
 */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const linea = await pool.query(
    `INSERT INTO "Lineas" ("Nombre", "ModifiedDate", "ModifiedBy")
     VALUES ('L1', now(), 0) RETURNING "Id"`,
  );
  const lineaId = linea.rows[0].Id;

  const itinerario = await pool.query(
    `INSERT INTO "Itinerarios" ("LineaId", "Nombre", "TiempoReal", "TiempoPago", "ModifiedDate", "ModifiedBy")
     VALUES ($1, 'IDA', 90, 90, now(), 0) RETURNING "Id"`,
    [lineaId],
  );
  const itinerarioId = itinerario.rows[0].Id;

  const parada = await pool.query(
    `INSERT INTO "Paradas" ("ItinerarioId", "Orden", "Tiempo", "ModifiedDate", "ModifiedBy")
     VALUES ($1, 1, '00:05:00', now(), 0) RETURNING "Id"`,
    [itinerarioId],
  );

  const borrada = await pool.query(`DELETE FROM "Lineas" WHERE "Id" = $1`, [lineaId]);
  const quedanItinerarios = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "Itinerarios" WHERE "LineaId" = $1`, [lineaId],
  );
  const quedanParadas = await pool.query(
    `SELECT COUNT(*)::int AS n FROM "Paradas" WHERE "ItinerarioId" = $1`, [itinerarioId],
  );

  if (borrada.rowCount !== 1 || quedanItinerarios.rows[0].n !== 0 || quedanParadas.rows[0].n !== 0) {
    throw new Error("El borrado en cascada no funcionó");
  }

  console.log("Humo OK ▸ lineas/itinerarios/paradas creados y borrados en cascada:", parada.rows[0].Id);

  const tablas = await pool.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  console.log("Tablas en 'public':", tablas.rows[0].n);
} finally {
  await pool.end();
}

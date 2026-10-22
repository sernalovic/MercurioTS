/* Ajusta todas las secuencias del esquema de desarrollo al MAX(Id)+1
 * (la importación inicial insertó Ids explícitos y dejaba las secuencias atrás). */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const tablas = [
  "Conductores", "Regulaciones", "Convenios", "OpcionesCentro", "TablasSalariales",
  "Festivos", "Calendarios", "DiasCalendario", "Resumenes", "Reclamaciones",
  "ConceptosReclamados", "Nominas", "ConceptosNomina", "Graficos",
  "ItinerariosGraficos", "Lineas", "Itinerarios", "Paradas",
];
for (const t of tablas) {
  try {
    const r = await pool.query(
      `SELECT setval(pg_get_serial_sequence($1, 'Id'), COALESCE((SELECT MAX("Id") FROM "${t}"), 0) + 1, false) AS v`,
      [`"${t}"`],
    );
    console.log(`${t}: secuencia -> ${r.rows[0].v}`);
  } catch (e) {
    console.log(`${t}: ERROR ${String(e.message).slice(0, 200)}`);
  }
}
await pool.end();

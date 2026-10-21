/**
 * Importa la configuración de convenio de una BD original a otra: tablas
 * Convenios, OpcionesCentro, Festivos y TablasSalariales (datos de contrato,
 * no personales). Borra previamente las filas de destino en orden inverso.
 *
 *   node --experimental-transform-types scripts/importarConfiguracion.ts \
 *        "postgresql://usuario:clave@host:5432/origen" "postgresql://usuario:clave@host:5432/destino"
 */
import { Pool } from "pg";

const TABLAS = ["Convenios", "OpcionesCentro", "Festivos", "TablasSalariales"];

async function main(): Promise<void> {
  const [origenUrl, destinoUrl] = process.argv.slice(2);
  if (origenUrl === undefined || destinoUrl === undefined) {
    throw new Error("Uso: node scripts/importarConfiguracion.ts <url_origen> <url_destino>");
  }
  const origen = new Pool({ connectionString: origenUrl });
  const destino = new Pool({ connectionString: destinoUrl });

  for (const tabla of [...TABLAS].reverse()) {
    await destino.query(`DELETE FROM "${tabla}" WHERE true`);
  }

  for (const tabla of TABLAS) {
    const filas = await origen.query(`SELECT * FROM "${tabla}"`);
    console.log(`${tabla}: ${filas.rows.length} filas`);
    for (const f of filas.rows) {
      const cols = Object.keys(f);
      const nombres = cols.map((c) => `"${c}"`).join(", ");
      const marcadores = cols.map((_, i) => `$${i + 1}`).join(", ");
      await destino.query(
        `INSERT INTO "${tabla}" (${nombres}) VALUES (${marcadores})`,
        cols.map((c) => f[c]),
      );
    }
  }

  await origen.end();
  await destino.end();
  console.log("Listo.");
}

main();
